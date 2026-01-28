import { useState, useMemo, useEffect } from 'react';
import { RouteHeader } from '@/components/RouteHeader';
import { StopsList } from '@/components/StopsList';
import { RouteActionButton } from '@/components/RouteActionButton';
import { InlineMessage } from '@/components/InlineMessage';
import { DriverInfo, Stop, RouteState } from '@/types/driver';
import { LogOut, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { toast } from 'sonner';
import { saveStopsProgressToFirebase } from '@/services/firebaseService';
import { finishTrip, markStopReached, startTrip, updateTripRouteState } from '@/services/tripService';

interface MainRoutePageProps {
  driver: DriverInfo;
  onLogout: () => void;
}

export function MainRoutePage({ driver, onLogout }: MainRoutePageProps) {
  const [stops, setStops] = useState<Stop[]>(driver.route.stops);
  const [routeState, setRouteState] = useState<RouteState>('not_started');
  const [message, setMessage] = useState<{ type: 'error' | 'warning' | 'info' | 'success'; text: string } | null>(null);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  // Location tracking hook - automatically starts when route is in progress
  const { currentLocation, isTracking, error: locationError } = useLocationTracking({
    driver,
    routeState,
    isActive: true,
    updateInterval: 5000 // Update every 5 seconds
  });

  const currentStopIndex = useMemo(() => {
    return stops.findIndex((stop) => stop.status === 'current');
  }, [stops]);

  const currentStop = currentStopIndex >= 0 ? stops[currentStopIndex] : undefined;
  const isLastStop = currentStopIndex === stops.length - 1;

  // After a trip is completed, automatically reset the screen back to the
  // initial "START ROUTE" state so the driver can begin the next trip.
  useEffect(() => {
    if (routeState !== 'completed') return;

    const resetTimer = setTimeout(() => {
      // Reset all stops back to pending and clear any active stop
      const resetStops = driver.route.stops.map((stop) => ({
        ...stop,
        status: 'pending' as const,
      }));

      setStops(resetStops);
      setRouteState('not_started');
      setMessage(null);
      setActiveTripId(null);

      // Persist reset stops back to Realtime Database (so student app sees fresh trip state)
      saveStopsProgressToFirebase(
        driver.route.busNumber,
        resetStops.map((s) => ({ id: s.id, name: s.name, order: s.order, status: s.status })),
      ).catch((e) => console.error("Failed to save reset stops progress:", e));
    }, 8000); // give a short window for the completion popup/message

    return () => clearTimeout(resetTimer);
  }, [routeState, driver.route.stops]);

  const handleStartRoute = () => {
    const nextStops = stops.map((stop, index) =>
      index === 0 ? { ...stop, status: 'current' as const } : { ...stop, status: 'pending' as const },
    );

    setStops(nextStops);
    setRouteState('in_progress');
    setMessage({ type: 'info', text: 'Route started. GPS tracking active. Drive safely!' });

    // Create a Firestore trip history doc (trips collection)
    startTrip({
      busNumber: driver.route.busNumber,
      routeId: driver.route.id,
      routeName: driver.route.name,
      driverId: driver.id,
      driverName: driver.name,
      stops: nextStops,
    })
      .then((tripId) => {
        setActiveTripId(tripId);
        // Track current stop in trip doc
        const current = nextStops.find((s) => s.status === "current") ?? null;
        return updateTripRouteState({
          busNumber: driver.route.busNumber,
          tripId,
          routeState: "in_progress",
          currentStop: current
            ? { id: current.id, name: current.name, order: current.order, status: current.status }
            : null,
        });
      })
      .catch((e) => console.error("Failed to start trip history:", e));

    // Save stop progress to Realtime Database (under buses/{busNumber})
    saveStopsProgressToFirebase(
      driver.route.busNumber,
      nextStops.map((s) => ({ id: s.id, name: s.name, order: s.order, status: s.status })),
    ).catch((e) => console.error("Failed to save stops progress:", e));
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  const handleMarkReached = () => {
    const currentIndex = stops.findIndex((stop) => stop.status === 'current');
    
    if (currentIndex === -1) return;

    const isLastStop = currentIndex === stops.length - 1;
    const reachedStop = stops[currentIndex];

    const nextStops = stops.map((stop, index) => {
      if (index === currentIndex) {
        return { ...stop, status: 'reached' as const };
      }
      if (index === currentIndex + 1 && !isLastStop) {
        return { ...stop, status: 'current' as const };
      }
      return stop;
    });

    setStops(nextStops);

    // Save trip history (arrival time for reached stop + current stop)
    if (activeTripId) {
      markStopReached({
        busNumber: driver.route.busNumber,
        tripId: activeTripId,
        stop: { id: reachedStop.id, name: reachedStop.name, order: reachedStop.order },
      }).catch((e) => console.error("Failed to mark stop reached in trip history:", e));

      const current = nextStops.find((s) => s.status === "current") ?? null;
      updateTripRouteState({
        busNumber: driver.route.busNumber,
        tripId: activeTripId,
        routeState: isLastStop ? "completed" : "in_progress",
        currentStop: current
          ? { id: current.id, name: current.name, order: current.order, status: current.status }
          : null,
      }).catch((e) => console.error("Failed to update trip route state:", e));
    }

    // Save stop progress to Realtime Database (under buses/{busNumber})
    saveStopsProgressToFirebase(
      driver.route.busNumber,
      nextStops.map((s) => ({ id: s.id, name: s.name, order: s.order, status: s.status })),
    ).catch((e) => console.error("Failed to save stops progress:", e));

    if (isLastStop) {
      setRouteState('completed');

      // Finalize trip history in Firestore
      if (activeTripId) {
        finishTrip({ busNumber: driver.route.busNumber, tripId: activeTripId }).catch((e) =>
          console.error("Failed to finish trip history:", e),
        );
      }
      
      // Show popup toast notification when route is finished
      toast.success('Trip Completed!', {
        description: 'All students have been safely dropped off. Great job! 🎉',
        duration: 5000,
        position: 'top-center',
        style: {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          border: 'none',
          fontSize: '16px',
          fontWeight: '600',
        },
      });
      
      // Also show inline message
      setMessage({ 
        type: 'success', 
        text: '🎉 Trip Completed! All students have been safely dropped off. Great job!' 
      });
      // Keep the completion message visible longer (10 seconds)
      setTimeout(() => setMessage(null), 10000);
    } else {
      setMessage({ type: 'info', text: `${stops[currentIndex].name} marked as reached.` });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <RouteHeader
        driverName={driver.name}
        busNumber={driver.route.busNumber}
        routeName={driver.route.name}
      />

      {/* Main Content */}
      <main className="flex-1 container py-4 space-y-4">
        {/* Message Area */}
        {message && (
          <div className={message.type === 'success' ? 'bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 rounded-lg p-4 shadow-lg' : ''}>
            <InlineMessage type={message.type} message={message.text} />
          </div>
        )}

        {/* Location Tracking Status */}
        {routeState === 'in_progress' && (
          <div className="bg-card border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">GPS Tracking</span>
              <span className={`ml-auto px-2 py-1 rounded text-xs ${
                isTracking 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {isTracking ? 'Active' : 'Connecting...'}
              </span>
            </div>
            {currentLocation && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Lat: {currentLocation.latitude.toFixed(6)}</div>
                <div>Lng: {currentLocation.longitude.toFixed(6)}</div>
                {currentLocation.accuracy && (
                  <div>Accuracy: ±{Math.round(currentLocation.accuracy)}m</div>
                )}
              </div>
            )}
            {locationError && (
              <InlineMessage 
                type="error" 
                message={`GPS Error: ${locationError}`} 
              />
            )}
          </div>
        )}

        {/* Stops List */}
        <StopsList stops={stops} />

        {/* Action Button */}
        <div className="sticky bottom-4 pt-2">
          <RouteActionButton
            routeState={routeState}
            currentStopName={currentStop?.name}
            isLastStop={isLastStop}
            onStartRoute={handleStartRoute}
            onMarkReached={handleMarkReached}
          />
        </div>

        {/* Logout Button */}
        <div className="pt-4">
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </main>
    </div>
  );
}
