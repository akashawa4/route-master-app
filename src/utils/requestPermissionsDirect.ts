import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';

/**
 * Request permissions directly using native Android dialogs
 * Similar to how delivery apps do it - no custom UI, just native prompts
 * If denied, shows a toast but doesn't block the app
 */
export async function requestPermissionsDirect(): Promise<{
  foregroundLocation: boolean;
  backgroundLocation: boolean;
  batteryOptimization: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    // On web, just request geolocation
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return {
        foregroundLocation: permission.state === 'granted',
        backgroundLocation: true,
        batteryOptimization: true,
      };
    } catch {
      return {
        foregroundLocation: false,
        backgroundLocation: false,
        batteryOptimization: false,
      };
    }
  }

  const results = {
    foregroundLocation: false,
    backgroundLocation: false,
    batteryOptimization: false,
  };

  try {
    // Step 1: Request foreground location permission using Capacitor Geolocation
    // This shows the native Android permission dialog directly
    console.log('[Permissions] Requesting foreground location via Capacitor Geolocation...');
    const locationPermission = await Geolocation.requestPermissions();
    
    if (locationPermission.location === 'granted') {
      results.foregroundLocation = true;
      console.log('[Permissions] Foreground location granted');
      
      // Step 2: Request background location (Android 10+)
      // Wait a moment for foreground permission to register
      await new Promise(resolve => setTimeout(resolve, 800));
      
      try {
        console.log('[Permissions] Requesting background location...');
        const { Permissions } = await import('./permissions');
        // Call requestAllPermissions which will check foreground first, then request background
        const bgResult = await Permissions.requestAllPermissions();
        
        if (bgResult.backgroundLocation === 'granted') {
          results.backgroundLocation = true;
          console.log('[Permissions] Background location granted');
        } else if (bgResult.backgroundLocation === 'requested') {
          // Dialog is showing - user will interact
          console.log('[Permissions] Background location dialog shown');
        } else {
          // Denied - show info toast
          toast.info('Background location', {
            description: 'Select "Allow all the time" for continuous GPS tracking when screen is off',
            duration: 6000,
          });
        }
      } catch (bgError: any) {
        console.warn('[Permissions] Background location request failed:', bgError);
        // Continue anyway - don't block
        toast.info('Background location', {
          description: 'Enable "Allow all the time" in Settings → Apps → Route Master Driver → Permissions → Location',
          duration: 6000,
        });
      }
      
      // Step 3: Request battery optimization (opens settings, non-blocking)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        console.log('[Permissions] Requesting battery optimization...');
        const { Permissions } = await import('./permissions');
        const batteryResult = await Permissions.requestAllPermissions();
        
        if (batteryResult.batteryOptimization === 'granted') {
          results.batteryOptimization = true;
          console.log('[Permissions] Battery optimization granted');
        } else if (batteryResult.batteryOptimization === 'requested') {
          // Settings opened - show info toast
          toast.info('Battery optimization', {
            description: 'Select "Don\'t optimize" for best GPS tracking',
            duration: 6000,
          });
        }
      } catch (batteryError) {
        console.warn('[Permissions] Battery optimization request failed:', batteryError);
        // Continue anyway - don't block
      }
      
    } else {
      // Foreground location denied - show toast but continue (don't block)
      toast.warning('Location permission needed', {
        description: 'GPS tracking requires location permission. Enable it in Settings → Apps → Route Master Driver → Permissions',
        duration: 6000,
      });
    }
  } catch (error: any) {
    console.error('[Permissions] Error requesting permissions:', error);
    
    // Show helpful error toast but don't block
    toast.error('Permission required', {
      description: 'Enable location permission in Settings → Apps → Route Master Driver → Permissions → Location → Allow all the time',
      duration: 7000,
    });
  }

  return results;
}
