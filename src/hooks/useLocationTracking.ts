import { useEffect, useRef, useState, useCallback } from 'react';
import { watchLocation, clearWatch, LocationData, LocationError } from '@/services/locationService';
import { saveLocationToFirebase } from '@/services/firebaseService';
import { DriverInfo } from '@/types/driver';
import { RouteState } from '@/types/driver';

interface UseLocationTrackingOptions {
  driver: DriverInfo;
  routeState: RouteState;
  isActive: boolean;
  updateInterval?: number; // Update interval in milliseconds (default: 2000ms = 2 seconds)
}

export const useLocationTracking = ({
  driver,
  routeState,
  isActive,
  updateInterval = 2000
}: UseLocationTrackingOptions) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<LocationData | null>(null);
  const driverRef = useRef(driver);
  const routeStateRef = useRef(routeState);
  const updateIntervalRef = useRef(updateInterval);
  const consecutiveErrorsRef = useRef<number>(0);
  const lastErrorRef = useRef<string | null>(null);

  // Keep refs updated
  useEffect(() => {
    driverRef.current = driver;
    routeStateRef.current = routeState;
    updateIntervalRef.current = updateInterval;
  }, [driver, routeState, updateInterval]);

  // Stop location tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsTracking(false);
    setError(null);
  }, []);

  // Start location tracking
  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      return; // Already tracking
    }

    setIsTracking(true);
    setError(null);

    const watchId = watchLocation(
      (location) => {
        setCurrentLocation(location);
        lastLocationRef.current = location;
      },
      (locationError: LocationError) => {
        // GPS permission or location errors - always show these
        setError(locationError.message);
        lastErrorRef.current = locationError.message;
        setIsTracking(false);
      }
    );

    watchIdRef.current = watchId;

    // Push location to Firebase on a fixed interval using the latest known position
    intervalIdRef.current = window.setInterval(() => {
      const location = lastLocationRef.current;
      if (!location) {
        return;
      }

      const currentDriver = driverRef.current;
      const currentRouteState = routeStateRef.current;

      saveLocationToFirebase(
        currentDriver.id,
        currentDriver.name,
        currentDriver.route.busNumber,
        currentDriver.route.id,
        currentDriver.route.name,
        currentRouteState,
        location
      )
        .then(() => {
          // Successfully saved - clear error and reset error counter
          consecutiveErrorsRef.current = 0;
          // Only clear error if it was a save error, not a GPS permission error
          if (lastErrorRef.current && lastErrorRef.current.includes('save location')) {
            setError(null);
            lastErrorRef.current = null;
          }
        })
        .catch((err) => {
          console.error('Failed to save location:', err);
          consecutiveErrorsRef.current += 1;
          
          // Only show error to user after multiple consecutive failures
          // This prevents showing temporary network issues
          if (consecutiveErrorsRef.current >= 3) {
            const errorMsg = 'Failed to save location to server. Check your connection.';
            setError(errorMsg);
            lastErrorRef.current = errorMsg;
          }
        });
    }, updateIntervalRef.current);
    // routeState is written only from MainRoutePage (start/finish) to avoid repeated triggers
  }, []);

  // Effect to manage tracking based on isActive and routeState
  useEffect(() => {
    if (isActive && routeState === 'in_progress') {
      startTracking();
    } else {
      stopTracking();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      stopTracking();
    };
  }, [isActive, routeState, startTracking, stopTracking]);

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking
  };
};
