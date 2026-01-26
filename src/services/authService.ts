import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { DriverInfo } from "@/types/driver";
import { getRouteById } from "./firestoreService";

const COLLECTIONS = {
  DRIVERS: "drivers",
  BUSES: "buses",
  ROUTES: "routes"
} as const;

/**
 * Authenticate driver using credentials from Firestore (set by admin)
 * Verifies driverId (field) and password against Firestore, then authenticates with Firebase Auth
 * 
 * @param driverId - The driverId field value from Firestore (e.g., "DRV-001")
 * @param password - The password field value from Firestore
 */
export const authenticateDriver = async (
  driverId: string, 
  password: string
): Promise<DriverInfo | null> => {
  try {
    // Step 1: Query driver by driverId field (not document ID)
    const driversQuery = query(
      collection(firestore, COLLECTIONS.DRIVERS),
      where("driverId", "==", driverId)
    );

    const querySnapshot = await getDocs(driversQuery);

    if (querySnapshot.empty) {
      return null;
    }

    // Get the first matching document
    const driverDoc = querySnapshot.docs[0];
    const driverData = driverDoc.data();
    
    // Step 2: Verify password matches the one stored in Firestore (set by admin)
    if (driverData.password !== password) {
      return null;
    }

    // Step 3: Get email from driver data or use driverId as email
    // Admin can set email field, otherwise we use driverId@driverapp.com
    const email = driverData.email || `${driverId}@driverapp.com`;

    // Step 4: Authenticate with Firebase Auth (optional - don't fail if it doesn't work)
    // If user doesn't exist, create it automatically
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        // User doesn't exist in Firebase Auth, try to create it automatically
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          console.log('Firebase Auth user created automatically for driver:', driverId);
        } catch (createError: any) {
          // If creation fails, continue with Firestore verification only
          // Firebase Auth is optional for this app
          console.log('Firebase Auth user creation skipped, using Firestore authentication only');
        }
      } else if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
        // Password doesn't match Firebase Auth (but matches Firestore)
        // This is fine - we'll use Firestore authentication
        console.log('Firebase Auth credentials mismatch, using Firestore authentication only');
      } else {
        // Other auth errors - log but continue with Firestore verification
        console.log('Firebase Auth error:', authError.code, 'Continuing with Firestore verification only');
      }
    }

    // Step 5: Fetch route data
    // Based on your structure: Driver -> Bus (via assignedBusId) -> Route (via assignedRouteId)
    let routeId: string | null = null;
    let busNumber: string | null = null;
    let busData: any = null;
    
    // Get route from assigned bus (driver has assignedBusId)
    if (driverData.assignedBusId) {
      try {
        const busDocRef = doc(firestore, COLLECTIONS.BUSES, driverData.assignedBusId);
        const busDoc = await getDoc(busDocRef);
        
        if (busDoc.exists()) {
          busData = busDoc.data();
          // Bus has assignedRouteId field
          routeId = busData.assignedRouteId;
          // Bus has busNumber field
          busNumber = busData.busNumber;
        }
      } catch (busError) {
        console.error('Error fetching bus data:', busError);
        throw new Error("Failed to fetch bus information. Please contact admin.");
      }
    }

    // Fallback: Try direct routeId from driver (if exists)
    if (!routeId) {
      routeId = driverData.routeId || driverData.assignedRouteId || null;
    }

    if (!routeId) {
      throw new Error("Driver has no associated route. Please contact admin to assign a route.");
    }

    // Fetch route with busNumber (if available)
    const route = await getRouteById(routeId, busNumber || undefined);
    if (!route) {
      throw new Error("Route not found. Please contact admin.");
    }

    return {
      id: driverData.driverId || driverDoc.id, // Use driverId field or document ID as fallback
      name: driverData.name || "",
      route: route
    };
  } catch (error) {
    console.error("Error authenticating driver:", error);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOutDriver = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Listen to authentication state changes
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};
