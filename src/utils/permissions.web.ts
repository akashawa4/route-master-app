import { WebPlugin } from '@capacitor/core';
import type { PermissionsPlugin, PermissionStatus } from './permissions';

export class PermissionsWeb extends WebPlugin implements PermissionsPlugin {
  async requestAllPermissions(): Promise<PermissionStatus> {
    // On web, request geolocation permission
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

  async checkPermissions(): Promise<PermissionStatus> {
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
}
