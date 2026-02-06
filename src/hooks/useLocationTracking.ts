import { useEffect, useRef, useState, useCallback } from 'react';
import { watchLocation, clearWatch, LocationData, LocationError } from '@/services/locationService';
import { saveLocationToFirebase } from '@/services/firebaseService';
import { DriverInfo } from '@/types/driver';
import { RouteState } from '@/types/driver';
import { WakeLockManager, AppStateMonitor } from '@/utils/backgroundTracking';
import { startForegroundService, stopForegroundService, StartForegroundServiceOptions } from '@/utils/foregroundService';
import { checkPermissions } from '@/utils/permissions';
import { Capacitor } from '@capacitor/core';

interface UseLocationTrackingOptions {
  driver: DriverInfo;
  routeState: RouteState;
  isActive: boolean;
  updateInterval?: number;
  currentStopName?: string;
}

export const useLocationTracking = ({
  driver,
  routeState,
  isActive,
  updateInterval = 2000,
  currentStopName = ''
}: UseLocationTrackingOptions) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<string | number | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<LocationData | null>(null);
  const driverRef = useRef(driver);
  const routeStateRef = useRef(routeState);
  const updateIntervalRef = useRef(updateInterval);
  const currentStopNameRef = useRef(currentStopName);
  const consecutiveErrorsRef = useRef<number>(0);
  const lastErrorRef = useRef<string | null>(null);
  const wakeLockManagerRef = useRef<WakeLockManager>(new WakeLockManager());
  const appStateMonitorRef = useRef<AppStateMonitor>(new AppStateMonitor());
  const isNativeRef = useRef(Capacitor.isNativePlatform());

  // Track if tracking operation is in progress to prevent race conditions
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isTrackingRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    driverRef.current = driver;
    routeStateRef.current = routeState;
    updateIntervalRef.current = updateInterval;
    currentStopNameRef.current = currentStopName;
  }, [driver, routeState, updateInterval, currentStopName]);

  // Stop location tracking
  const stopTracking = useCallback(async () => {
    // Prevent multiple concurrent stop calls
    if (isStoppingRef.current || !isTrackingRef.current) {
      return;
    }

    isStoppingRef.current = true;
    console.log('[LocationTracking] Stopping tracking...');

    if (watchIdRef.current !== null) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Stop foreground service (Android)
    try {
      await stopForegroundService();
    } catch (err) {
      console.error('[LocationTracking] Error stopping foreground service:', err);
    }

    // Release wake lock
    await wakeLockManagerRef.current.release();

    isTrackingRef.current = false;
    setIsTracking(false);
    setError(null);
    isStoppingRef.current = false;
    console.log('[LocationTracking] Tracking stopped');
  }, []);

  // Start location tracking
  const startTracking = useCallback(async () => {
    // Prevent multiple concurrent start calls or starting while already tracking
    if (isStartingRef.current || isTrackingRef.current) {
      console.log('[LocationTracking] Already tracking or starting, skipping');
      return;
    }

    isStartingRef.current = true;
    console.log('[LocationTracking] Starting tracking...');

    // Set tracking state immediately
    isTrackingRef.current = true;
    setIsTracking(true);
    setError(null);

    // Verify permissions before starting
    try {
      const permStatus = await checkPermissions();
      console.log('[LocationTracking] Permission status:', permStatus);

      if (permStatus.foregroundLocation !== 'granted') {
        setError('Location permission not granted. Please grant all permissions.');
        isTrackingRef.current = false;
        setIsTracking(false);
        isStartingRef.current = false;
        return;
      }
    } catch (err) {
      console.error('[LocationTracking] Error checking permissions:', err);
    }

    const currentDriver = driverRef.current;
    const currentRouteState = routeStateRef.current;
    const stopName = currentStopNameRef.current;

    const serviceOptions: StartForegroundServiceOptions = {
      driverId: currentDriver.id,
      driverName: currentDriver.name,
      busNumber: currentDriver.route.busNumber,
      routeId: currentDriver.route.id,
      routeName: currentDriver.route.name,
      routeState: currentRouteState,
      currentStopName: stopName,
    };

    try {
      // Start foreground service (Android) - this starts NATIVE GPS tracking
      console.log('[LocationTracking] Starting foreground service with options:', serviceOptions);
      await startForegroundService(serviceOptions);
      console.log('[LocationTracking] Foreground service started successfully');

      // Acquire wake lock
      await wakeLockManagerRef.current.acquire();

      // On native platforms, GPS tracking is handled by the foreground service
      // We still use JavaScript location for UI updates only
      if (isNativeRef.current) {
        try {
          const watchId = await watchLocation(
            (location) => {
              setCurrentLocation(location);
              lastLocationRef.current = location;
            },
            (locationError: LocationError) => {
              console.error('[LocationTracking] JS location error (UI only):', locationError);
              // Don't stop tracking on native - the service continues independently
            }
          );
          watchIdRef.current = watchId;
        } catch (err) {
          console.warn('[LocationTracking] JS watch failed, but native service is running:', err);
        }
      } else {
        // Web platform - need full JS tracking
        const watchId = await watchLocation(
          (location) => {
            setCurrentLocation(location);
            lastLocationRef.current = location;
          },
          (locationError: LocationError) => {
            console.error('[LocationTracking] Location error:', locationError);
            setError(locationError.message);
            lastErrorRef.current = locationError.message;
          }
        );
        watchIdRef.current = watchId;

        // On web, push to Firebase from JavaScript
        intervalIdRef.current = window.setInterval(() => {
          const location = lastLocationRef.current;
          if (!location) return;

          const driver = driverRef.current;
          const routeState = routeStateRef.current;

          saveLocationToFirebase(
            driver.id,
            driver.name,
            driver.route.busNumber,
            driver.route.id,
            driver.route.name,
            routeState,
            location
          )
            .then(() => {
              consecutiveErrorsRef.current = 0;
              if (lastErrorRef.current?.includes('save location')) {
                setError(null);
                lastErrorRef.current = null;
              }
            })
            .catch((err) => {
              console.error('Failed to save location:', err);
              consecutiveErrorsRef.current += 1;

              if (consecutiveErrorsRef.current >= 3) {
                const errorMsg = 'Failed to save location to server. Check your connection.';
                setError(errorMsg);
                lastErrorRef.current = errorMsg;
              }
            });
        }, updateIntervalRef.current);
      }

      console.log('[LocationTracking] Tracking started successfully');
    } catch (err) {
      console.error('[LocationTracking] Failed to start tracking:', err);
      isTrackingRef.current = false;
      setIsTracking(false);
      setError('Failed to start GPS tracking. Please check permissions.');
    } finally {
      isStartingRef.current = false;
    }
  }, []);

  // Effect to manage tracking based on isActive and routeState
  useEffect(() => {
    const shouldTrack = isActive && routeState === 'in_progress';

    if (shouldTrack && !isTrackingRef.current) {
      startTracking();
    } else if (!shouldTrack && isTrackingRef.current) {
      stopTracking();
    }
  }, [isActive, routeState]); // Removed startTracking/stopTracking from deps to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTrackingRef.current) {
        stopTracking();
      }
    };
  }, [stopTracking]);

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking
  };
};
