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
import {
  markStopReachedInRTDB,
  saveStopsProgressToFirebase,
  updateRouteState,
  writeBusLocationMeta,
} from '@/services/firebaseService';
import { finishTrip, getActiveTrip, markStopReached, startTrip, updateTripRouteState } from '@/services/tripService';

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
    updateInterval: 2000 // Update every 2 seconds for smoother live tracking
  });

  const currentStopIndex = useMemo(() => {
    return stops.findIndex((stop) => stop.status === 'current');
  }, [stops]);

  const currentStop = currentStopIndex >= 0 ? stops[currentStopIndex] : undefined;
  const isLastStop = currentStopIndex === stops.length - 1;

  // Restore active trip state on mount (e.g., after app refresh/close)
  useEffect(() => {
    let isMounted = true;

    const restoreTripState = async () => {
      try {
        const activeTrip = await getActiveTrip(driver.route.busNumber);
        
        if (!isMounted || !activeTrip) {
          return; // No active trip, start fresh
        }

        // Restore stops status from trip data
        const restoredStops = driver.route.stops.map((stop) => {
          const tripStop = activeTrip.stops[stop.id];
          if (tripStop) {
            return {
              ...stop,
              status: tripStop.status,
            };
          }
          return stop;
        });

        // If currentStop exists in trip, ensure it's marked as current
        if (activeTrip.currentStop) {
          const currentStopIndex = restoredStops.findIndex(
            (s) => s.id === activeTrip.currentStop!.id
          );
          if (currentStopIndex >= 0) {
            restoredStops[currentStopIndex].status = 'current';
            // Mark previous stops as reached
            for (let i = 0; i < currentStopIndex; i++) {
              if (restoredStops[i].status !== 'reached') {
                restoredStops[i].status = 'reached';
              }
            }
            // Mark later stops as pending
            for (let i = currentStopIndex + 1; i < restoredStops.length; i++) {
              if (restoredStops[i].status !== 'reached') {
                restoredStops[i].status = 'pending';
              }
            }
          }
        }

        if (!isMounted) return;

        // Restore state
        setStops(restoredStops);
        setRouteState(activeTrip.routeState);
        setActiveTripId(activeTrip.tripId);

        // Sync RTDB state to match restored trip
        const busNumber = driver.route.busNumber;
        const routeId = driver.route.id;
        const routeName = driver.route.name;

        // Update routeState in RTDB
        updateRouteState(driver.id, busNumber, activeTrip.routeState).catch((e) =>
          console.error('Failed to sync routeState to RTDB:', e)
        );

        // Update stops progress in RTDB
        saveStopsProgressToFirebase(
          busNumber,
          restoredStops.map((s) => ({ id: s.id, name: s.name, order: s.order, status: s.status }))
        ).catch((e) => console.error('Failed to sync stops progress to RTDB:', e));

        // Update location meta in RTDB
        writeBusLocationMeta(busNumber, routeId, routeName, driver.name, activeTrip.routeState).catch(
          (e) => console.error('Failed to sync location meta to RTDB:', e)
        );

        setMessage({
          type: 'info',
          text: 'Route state restored. Continuing from where you left off.',
        });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Error restoring trip state:', error);
        if (isMounted) {
          setMessage({
            type: 'warning',
            text: 'Could not restore previous route state. Starting fresh.',
          });
          setTimeout(() => setMessage(null), 3000);
        }
      }
    };

    restoreTripState();

    return () => {
      isMounted = false;
    };
  }, [driver]);

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

      // Persist reset stops and routeState so next Start is not_started → in_progress (triggers notification)
      const busNum = driver.route.busNumber;
      saveStopsProgressToFirebase(
        busNum,
        resetStops.map((s) => ({ id: s.id, name: s.name, order: s.order, status: s.status })),
      ).catch((e) => console.error("Failed to save reset stops progress:", e));
      updateRouteState(driver.id, busNum, "not_started").catch((e) =>
        console.error("Failed to write routeState not_started:", e),
      );
    }, 8000); // give a short window for the completion popup/message

    return () => clearTimeout(resetTimer);
  }, [routeState, driver.route.stops]);

  const handleStartRoute = async () => {
    // Prevent double Start so backend sees not_started → in_progress once (not in_progress → in_progress)
    if (routeState === "in_progress") return;

    const nextStops = stops.map((stop, index) =>
      index === 0 ? { ...stop, status: 'current' as const } : { ...stop, status: 'pending' as const },
    );
    const busNumber = driver.route.busNumber;
    const routeId = driver.route.id;
    const routeName = driver.route.name;

    setStops(nextStops);
    setRouteState('in_progress');
    setMessage({ type: 'info', text: 'Route started. GPS tracking active. Drive safely!' });

    // 1) Write location meta first so Cloud Function has routeId when routeState triggers
    writeBusLocationMeta(busNumber, routeId, routeName, driver.name, 'in_progress').catch((e) =>
      console.error('Failed to write bus location meta:', e),
    );
    // 2) Then routeState once: not_started → in_progress (triggers notifyStudentsRouteStarted)
    updateRouteState(driver.id, busNumber, 'in_progress').catch((e) =>
      console.error('Failed to update route state:', e),
    );
    // 3) Stops progress (initial: first=current, rest=pending; do not overwrite "reached" later)
    saveStopsProgressToFirebase(
      busNumber,
      nextStops.map((s) => ({ id: s.id, name: s.name, order: s.order, status: s.status })),
    ).catch((e) => console.error('Failed to save stops progress:', e));

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

    // Single write for this stop only (triggers Cloud Function once; backend dedupes with notified flag)
    const nextCurrent = nextStops.find((s) => s.status === "current") ?? null;
    markStopReachedInRTDB(
      driver.route.busNumber,
      reachedStop.id,
      Date.now(),
      nextCurrent
        ? {
            id: nextCurrent.id,
            name: nextCurrent.name,
            order: nextCurrent.order,
            status: nextCurrent.status,
          }
        : null,
    ).catch((e) => console.error("Failed to mark stop reached in RTDB:", e));

    if (isLastStop) {
      setRouteState('completed');
      // Write routeState completed so backend can clear notification flags for next trip
      updateRouteState(driver.id, driver.route.busNumber, 'completed').catch((e) =>
        console.error('Failed to update route state:', e),
      );

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
