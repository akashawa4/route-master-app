package com.route.master.driver;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Permissions")
public class PermissionsPlugin extends Plugin {
    private static final String TAG = "PermissionsPlugin";

    private static final int FOREGROUND_LOCATION_REQUEST_CODE = 1001;
    private static final int BACKGROUND_LOCATION_REQUEST_CODE = 1002;
    private static final int BATTERY_OPTIMIZATION_REQUEST_CODE = 1003;
    private static final int NOTIFICATION_REQUEST_CODE = 1004;

    private PluginCall pendingCall;
    private int currentPermissionStep = 0;

    @PluginMethod
    public void requestAllPermissions(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        pendingCall = call;
        currentPermissionStep = 0;

        Log.d(TAG, "Starting permission request flow...");
        requestNextPermission();
    }

    private void requestNextPermission() {
        if (pendingCall == null)
            return;

        Activity activity = getActivity();
        if (activity == null) {
            resolvePendingCall();
            return;
        }

        switch (currentPermissionStep) {
            case 0:
                // Step 1: Foreground Location
                if (!hasForegroundLocationPermission()) {
                    Log.d(TAG, "Requesting foreground location permission");
                    ActivityCompat.requestPermissions(
                            activity,
                            new String[] {
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                            },
                            FOREGROUND_LOCATION_REQUEST_CODE);
                    return;
                }
                currentPermissionStep++;
                // Fall through

            case 1:
                // Step 2: Background Location (Android 10+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocationPermission()) {
                    Log.d(TAG, "Requesting background location permission");
                    ActivityCompat.requestPermissions(
                            activity,
                            new String[] { Manifest.permission.ACCESS_BACKGROUND_LOCATION },
                            BACKGROUND_LOCATION_REQUEST_CODE);
                    return;
                }
                currentPermissionStep++;
                // Fall through

            case 2:
                // Step 3: Notifications (Android 13+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission()) {
                    Log.d(TAG, "Requesting notification permission");
                    ActivityCompat.requestPermissions(
                            activity,
                            new String[] { Manifest.permission.POST_NOTIFICATIONS },
                            NOTIFICATION_REQUEST_CODE);
                    return;
                }
                currentPermissionStep++;
                // Fall through

            case 3:
                // Step 4: Battery Optimization
                if (!isBatteryOptimizationIgnored()) {
                    Log.d(TAG, "Requesting battery optimization exemption");
                    requestBatteryOptimizationIgnore();
                    return;
                }
                currentPermissionStep++;
                // Fall through

            default:
                // All permissions requested
                Log.d(TAG, "All permissions requested, resolving call");
                resolvePendingCall();
                break;
        }
    }

    private void resolvePendingCall() {
        if (pendingCall == null)
            return;

        JSObject result = new JSObject();
        result.put("foregroundLocation", hasForegroundLocationPermission() ? "granted" : "denied");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            result.put("backgroundLocation", hasBackgroundLocationPermission() ? "granted" : "denied");
        } else {
            result.put("backgroundLocation", "granted");
        }

        result.put("batteryOptimization", isBatteryOptimizationIgnored() ? "granted" : "denied");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            result.put("notifications", hasNotificationPermission() ? "granted" : "denied");
        } else {
            result.put("notifications", "granted");
        }

        Log.d(TAG, "Permission result: " + result.toString());
        pendingCall.resolve(result);
        pendingCall = null;
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("foregroundLocation", hasForegroundLocationPermission() ? "granted" : "denied");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            result.put("backgroundLocation", hasBackgroundLocationPermission() ? "granted" : "denied");
        } else {
            result.put("backgroundLocation", "granted");
        }

        result.put("batteryOptimization", isBatteryOptimizationIgnored() ? "granted" : "denied");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            result.put("notifications", hasNotificationPermission() ? "granted" : "denied");
        } else {
            result.put("notifications", "granted");
        }

        call.resolve(result);
    }

    private boolean hasForegroundLocationPermission() {
        return ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private boolean isBatteryOptimizationIgnored() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getContext()
                    .getSystemService(android.content.Context.POWER_SERVICE);
            if (pm != null) {
                return pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        }
        return true;
    }

    private void requestBatteryOptimizationIgnore() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Activity activity = getActivity();
            if (activity != null) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    activity.startActivityForResult(intent, BATTERY_OPTIMIZATION_REQUEST_CODE);
                } catch (Exception e) {
                    Log.e(TAG, "Error opening battery optimization settings: " + e.getMessage());
                    currentPermissionStep++;
                    requestNextPermission();
                }
            }
        }
    }

    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);

        Log.d(TAG, "Permission result received for code: " + requestCode);

        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        switch (requestCode) {
            case FOREGROUND_LOCATION_REQUEST_CODE:
                Log.d(TAG, "Foreground location " + (granted ? "granted" : "denied"));
                if (!granted) {
                    // If foreground denied, skip remaining location permissions
                    currentPermissionStep = 2;
                } else {
                    currentPermissionStep = 1;
                }
                break;

            case BACKGROUND_LOCATION_REQUEST_CODE:
                Log.d(TAG, "Background location " + (granted ? "granted" : "denied"));
                currentPermissionStep = 2;
                break;

            case NOTIFICATION_REQUEST_CODE:
                Log.d(TAG, "Notification " + (granted ? "granted" : "denied"));
                currentPermissionStep = 3;
                break;
        }

        // Continue with next permission after a brief delay
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            requestNextPermission();
        }, 500);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == BATTERY_OPTIMIZATION_REQUEST_CODE) {
            Log.d(TAG, "Battery optimization result received");
            currentPermissionStep = 4;
            requestNextPermission();
        }
    }
}
