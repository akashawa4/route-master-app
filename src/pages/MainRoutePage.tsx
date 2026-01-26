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

interface MainRoutePageProps {
  driver: DriverInfo;
  onLogout: () => void;
}

export function MainRoutePage({ driver, onLogout }: MainRoutePageProps) {
  const [stops, setStops] = useState<Stop[]>(driver.route.stops);
  const [routeState, setRouteState] = useState<RouteState>('not_started');
  const [message, setMessage] = useState<{ type: 'error' | 'warning' | 'info' | 'success'; text: string } | null>(null);

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

  const handleStartRoute = () => {
    setStops((prev) =>
      prev.map((stop, index) =>
        index === 0 ? { ...stop, status: 'current' as const } : stop
      )
    );
    setRouteState('in_progress');
    setMessage({ type: 'info', text: 'Route started. GPS tracking active. Drive safely!' });
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  const handleMarkReached = () => {
    const currentIndex = stops.findIndex((stop) => stop.status === 'current');
    
    if (currentIndex === -1) return;

    const isLastStop = currentIndex === stops.length - 1;

    setStops((prev) =>
      prev.map((stop, index) => {
        if (index === currentIndex) {
          return { ...stop, status: 'reached' as const };
        }
        if (index === currentIndex + 1 && !isLastStop) {
          return { ...stop, status: 'current' as const };
        }
        return stop;
      })
    );

    if (isLastStop) {
      setRouteState('completed');
      
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
