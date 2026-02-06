package com.route.master.driver;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocationService")
public class LocationServicePlugin extends Plugin {

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        try {
            // Extract route/driver data from the call
            String driverId = call.getString("driverId", "");
            String driverName = call.getString("driverName", "");
            String busNumber = call.getString("busNumber", "");
            String routeId = call.getString("routeId", "");
            String routeName = call.getString("routeName", "");
            String routeState = call.getString("routeState", "in_progress");

            Intent serviceIntent = new Intent(getContext(), LocationTrackingService.class);
            serviceIntent.putExtra("driverId", driverId);
            serviceIntent.putExtra("driverName", driverName);
            serviceIntent.putExtra("busNumber", busNumber);
            serviceIntent.putExtra("routeId", routeId);
            serviceIntent.putExtra("routeName", routeName);
            serviceIntent.putExtra("routeState", routeState);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Foreground service started with GPS tracking");
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Permission denied: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Failed to start foreground service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), LocationTrackingService.class);
            getContext().stopService(serviceIntent);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop foreground service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updateRouteInfo(PluginCall call) {
        // This would require binding to the service - for simplicity, restart the
        // service with new data
        try {
            String driverId = call.getString("driverId", "");
            String driverName = call.getString("driverName", "");
            String busNumber = call.getString("busNumber", "");
            String routeId = call.getString("routeId", "");
            String routeName = call.getString("routeName", "");
            String routeState = call.getString("routeState", "in_progress");

            // Restart service with updated info
            Intent stopIntent = new Intent(getContext(), LocationTrackingService.class);
            getContext().stopService(stopIntent);

            Intent startIntent = new Intent(getContext(), LocationTrackingService.class);
            startIntent.putExtra("driverId", driverId);
            startIntent.putExtra("driverName", driverName);
            startIntent.putExtra("busNumber", busNumber);
            startIntent.putExtra("routeId", routeId);
            startIntent.putExtra("routeName", routeName);
            startIntent.putExtra("routeState", routeState);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(startIntent);
            } else {
                getContext().startService(startIntent);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Route info updated");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to update route info: " + e.getMessage());
        }
    }
}
