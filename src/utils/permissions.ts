import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface PermissionStatus {
  foregroundLocation: string;
  backgroundLocation: string;
  batteryOptimization: string;
  notifications?: string;
}

export interface PermissionsPlugin {
  requestAllPermissions(): Promise<PermissionStatus>;
  checkPermissions(): Promise<PermissionStatus>;
}

let Permissions: PermissionsPlugin;

try {
  Permissions = registerPlugin<PermissionsPlugin>('Permissions', {
    web: () => import('./permissions.web').then((m) => new m.PermissionsWeb()),
  });
} catch (error) {
  console.error('[Permissions] Failed to register plugin:', error);
  // Fallback to web implementation
  Permissions = {
    requestAllPermissions: async () => ({
      foregroundLocation: 'denied',
      backgroundLocation: 'denied',
      batteryOptimization: 'denied',
      notifications: 'denied',
    }),
    checkPermissions: async () => ({
      foregroundLocation: 'denied',
      backgroundLocation: 'denied',
      batteryOptimization: 'denied',
      notifications: 'denied',
    }),
  } as PermissionsPlugin;
}

/**
 * Request all required permissions for background GPS tracking
 * Similar to Swiggy/Zomato delivery apps - asks for everything upfront
 * 
 * Permissions requested:
 * 1. Foreground Location (ACCESS_FINE_LOCATION)
 * 2. Background Location (ACCESS_BACKGROUND_LOCATION) - Android 10+
 * 3. Notifications (POST_NOTIFICATIONS) - Android 13+
 * 4. Battery Optimization exemption
 */
export async function requestAllPermissions(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    // On web, just check geolocation API
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return {
        foregroundLocation: permission.state === 'granted' ? 'granted' : 'denied',
        backgroundLocation: 'granted', // Not applicable on web
        batteryOptimization: 'granted', // Not applicable on web
        notifications: 'granted', // Not applicable on web
      };
    } catch {
      return {
        foregroundLocation: 'denied',
        backgroundLocation: 'granted',
        batteryOptimization: 'granted',
        notifications: 'granted',
      };
    }
  }

  try {
    console.log('[Permissions] Requesting all permissions via custom plugin...');

    // Try custom plugin first
    try {
      const result = await Permissions.requestAllPermissions();
      console.log('[Permissions] Custom plugin result:', result);
      return result;
    } catch (pluginError: any) {
      console.warn('[Permissions] Custom plugin failed, trying fallback:', pluginError);

      // Fallback: Use Capacitor Geolocation to request location permission
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        await Geolocation.requestPermissions();
        console.log('[Permissions] Geolocation permission requested via Capacitor');
      } catch (geoError) {
        console.error('[Permissions] Geolocation fallback failed:', geoError);
      }

      // Return current status
      const currentStatus = await checkPermissions();
      return currentStatus;
    }
  } catch (error: any) {
    console.error('[Permissions] Error requesting permissions:', error);
    console.error('[Permissions] Error details:', error.message, error.code);

    // Return current status on error
    try {
      const currentStatus = await checkPermissions();
      return currentStatus;
    } catch {
      return {
        foregroundLocation: 'denied',
        backgroundLocation: 'denied',
        batteryOptimization: 'denied',
        notifications: 'denied',
      };
    }
  }
}

/**
 * Check current permission status
 */
export async function checkPermissions(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return {
        foregroundLocation: permission.state === 'granted' ? 'granted' : 'denied',
        backgroundLocation: 'granted',
        batteryOptimization: 'granted',
        notifications: 'granted',
      };
    } catch {
      return {
        foregroundLocation: 'denied',
        backgroundLocation: 'granted',
        batteryOptimization: 'granted',
        notifications: 'granted',
      };
    }
  }

  try {
    return await Permissions.checkPermissions();
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      foregroundLocation: 'denied',
      backgroundLocation: 'denied',
      batteryOptimization: 'denied',
      notifications: 'denied',
    };
  }
}

/**
 * Check if all required permissions for background tracking are granted
 */
export async function hasAllRequiredPermissions(): Promise<boolean> {
  const status = await checkPermissions();
  return (
    status.foregroundLocation === 'granted' &&
    status.backgroundLocation === 'granted' &&
    status.batteryOptimization === 'granted'
  );
}
