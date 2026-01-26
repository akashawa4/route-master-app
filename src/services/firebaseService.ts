import { ref, set, onDisconnect, serverTimestamp } from "firebase/database";
import { database } from "@/lib/firebase";
import { LocationData } from "./locationService";

export interface BusLocationData extends LocationData {
  driverId: string;
  driverName: string;
  busNumber: string;
  routeId: string;
  routeName: string;
  routeState: 'not_started' | 'in_progress' | 'completed';
}

/**
 * Remove undefined values from an object
 * Firebase Realtime Database doesn't allow undefined values
 */
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  
  return obj;
};

/**
 * Save location to Firebase Realtime Database
 */
export const saveLocationToFirebase = async (
  driverId: string,
  driverName: string,
  busNumber: string,
  routeId: string,
  routeName: string,
  routeState: 'not_started' | 'in_progress' | 'completed',
  location: LocationData
): Promise<void> => {
  try {
    // Build location data object, only including defined values
    const locationData: any = {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp,
      driverId,
      driverName,
      busNumber,
      routeId,
      routeName,
      routeState
    };

    // Only add optional fields if they are defined
    if (location.accuracy !== undefined && location.accuracy !== null) {
      locationData.accuracy = location.accuracy;
    }
    if (location.speed !== undefined && location.speed !== null) {
      locationData.speed = location.speed;
    }
    if (location.heading !== undefined && location.heading !== null) {
      locationData.heading = location.heading;
    }

    // Remove any undefined values (safety check)
    const cleanedLocationData = removeUndefined(locationData);

    // Save to Firebase Realtime Database
    // Structure: /buses/{busNumber}/location
    const locationRef = ref(database, `buses/${busNumber}/location`);
    await set(locationRef, {
      ...cleanedLocationData,
      updatedAt: serverTimestamp()
    });

    // Also save to driver-specific path for tracking
    const driverLocationRef = ref(database, `drivers/${driverId}/location`);
    await set(driverLocationRef, {
      ...cleanedLocationData,
      updatedAt: serverTimestamp()
    });

    // Set up disconnect handler to mark driver as offline when they disconnect
    const driverStatusRef = ref(database, `drivers/${driverId}/status`);
    await onDisconnect(driverStatusRef).set({
      online: false,
      lastSeen: serverTimestamp()
    });

    // Mark driver as online
    await set(driverStatusRef, {
      online: true,
      lastSeen: serverTimestamp()
    });

    console.log('Location saved to Firebase successfully');
  } catch (error) {
    console.error('Error saving location to Firebase:', error);
    throw error;
  }
};

/**
 * Update route state in Firebase
 */
export const updateRouteState = async (
  driverId: string,
  busNumber: string,
  routeState: 'not_started' | 'in_progress' | 'completed'
): Promise<void> => {
  try {
    const routeStateRef = ref(database, `buses/${busNumber}/routeState`);
    await set(routeStateRef, {
      state: routeState,
      updatedAt: serverTimestamp()
    });

    const driverRouteStateRef = ref(database, `drivers/${driverId}/routeState`);
    await set(driverRouteStateRef, {
      state: routeState,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating route state:', error);
    throw error;
  }
};
