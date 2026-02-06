package com.route.master.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.firebase.FirebaseApp;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;

import java.util.HashMap;
import java.util.Map;

public class LocationTrackingService extends Service {
    private static final String TAG = "LocationTrackingService";
    private static final String CHANNEL_ID = "location_tracking_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long UPDATE_INTERVAL_MS = 2000; // 2 seconds

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private DatabaseReference databaseRef;
    private PowerManager.WakeLock wakeLock;

    // Route/Driver info
    private String driverId = "";
    private String driverName = "";
    private String busNumber = "";
    private String routeId = "";
    private String routeName = "";
    private String routeState = "";

    private boolean isServiceRunning = false;
    private Notification notification;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate called");

        // Create notification channel FIRST
        createNotificationChannel();

        // Create notification IMMEDIATELY
        notification = createNotification();

        // Initialize location client
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        // Initialize Firebase
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
                Log.d(TAG, "Firebase initialized in service");
            }

            // Get database reference with explicit URL
            FirebaseDatabase database = FirebaseDatabase
                    .getInstance("https://college-bus-tracking-903e7-default-rtdb.firebaseio.com");
            databaseRef = database.getReference();
            Log.d(TAG, "Firebase database reference obtained");
        } catch (Exception e) {
            Log.e(TAG, "Firebase initialization error: " + e.getMessage(), e);
        }

        // Acquire wake lock to keep CPU running
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "RouteMaster::LocationWakeLock");
            wakeLock.acquire(10 * 60 * 60 * 1000L); // 10 hours max
            Log.d(TAG, "Wake lock acquired");
        }

        // Setup location callback
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult locationResult) {
                Location location = locationResult.getLastLocation();
                if (location != null) {
                    Log.d(TAG, "Location received: " + location.getLatitude() + ", " + location.getLongitude());
                    sendLocationToFirebase(location);
                } else {
                    Log.w(TAG, "Location result was null");
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand called, isServiceRunning=" + isServiceRunning);

        // CRITICAL: Start foreground IMMEDIATELY - before anything else!
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            Log.d(TAG, "startForeground called successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground: " + e.getMessage(), e);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Extract route/driver info from intent
        if (intent != null) {
            driverId = intent.getStringExtra("driverId");
            driverName = intent.getStringExtra("driverName");
            busNumber = intent.getStringExtra("busNumber");
            routeId = intent.getStringExtra("routeId");
            routeName = intent.getStringExtra("routeName");
            routeState = intent.getStringExtra("routeState");

            if (driverId == null)
                driverId = "";
            if (driverName == null)
                driverName = "";
            if (busNumber == null)
                busNumber = "unknown";
            if (routeId == null)
                routeId = "";
            if (routeName == null)
                routeName = "";
            if (routeState == null)
                routeState = "";

            Log.d(TAG,
                    "Service config - busNumber: " + busNumber + ", routeId: " + routeId + ", driverId: " + driverId);
        }

        // Start location updates if not already running
        if (!isServiceRunning) {
            startLocationUpdates();
            isServiceRunning = true;
        }

        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "GPS Location Tracking",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Continuous GPS location tracking for bus route");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created");
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Route Master - GPS Active")
                .setContentText("Tracking your location continuously")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    private void startLocationUpdates() {
        Log.d(TAG, "Starting location updates...");

        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY,
                    UPDATE_INTERVAL_MS)
                    .setMinUpdateIntervalMillis(UPDATE_INTERVAL_MS / 2)
                    .setWaitForAccurateLocation(false)
                    .build();

            fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    Looper.getMainLooper());

            Log.d(TAG, "Location updates started successfully");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission denied: " + e.getMessage(), e);
        } catch (Exception e) {
            Log.e(TAG, "Error starting location updates: " + e.getMessage(), e);
        }
    }

    private void sendLocationToFirebase(Location location) {
        if (databaseRef == null) {
            Log.e(TAG, "Database reference is null, cannot send location");
            return;
        }

        if (busNumber == null || busNumber.isEmpty() || busNumber.equals("unknown")) {
            Log.w(TAG, "Bus number is not set, skipping Firebase update");
            return;
        }

        try {
            Map<String, Object> locationData = new HashMap<>();
            locationData.put("latitude", location.getLatitude());
            locationData.put("longitude", location.getLongitude());
            locationData.put("timestamp", System.currentTimeMillis());
            locationData.put("driverId", driverId);
            locationData.put("driverName", driverName);
            locationData.put("busNumber", busNumber);
            locationData.put("routeId", routeId);
            locationData.put("routeName", routeName);
            locationData.put("routeState", routeState);
            locationData.put("accuracy", location.getAccuracy());

            if (location.hasSpeed()) {
                locationData.put("speed", location.getSpeed());
            }
            if (location.hasBearing()) {
                locationData.put("heading", location.getBearing());
            }

            String path = "buses/" + busNumber + "/location";
            Log.d(TAG, "Sending location to Firebase path: " + path);

            databaseRef.child("buses").child(busNumber).child("location")
                    .setValue(locationData)
                    .addOnSuccessListener(aVoid -> {
                        Log.d(TAG, "Location sent to Firebase successfully: " +
                                location.getLatitude() + ", " + location.getLongitude());
                    })
                    .addOnFailureListener(e -> {
                        Log.e(TAG, "Failed to send location to Firebase: " + e.getMessage(), e);
                    });

        } catch (Exception e) {
            Log.e(TAG, "Error sending location to Firebase: " + e.getMessage(), e);
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy called");
        isServiceRunning = false;

        // Stop location updates
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            Log.d(TAG, "Location updates stopped");
        }

        // Release wake lock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "Wake lock released");
        }

        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // Method to update route info while service is running
    public void updateRouteInfo(String driverId, String driverName, String busNumber,
            String routeId, String routeName, String routeState) {
        this.driverId = driverId;
        this.driverName = driverName;
        this.busNumber = busNumber;
        this.routeId = routeId;
        this.routeName = routeName;
        this.routeState = routeState;
        Log.d(TAG, "Route info updated: busNumber=" + busNumber + ", routeState=" + routeState);
    }
}
