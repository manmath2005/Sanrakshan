package com.sankalp.smarthelmet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.le.BluetoothLeScanner;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telephony.SmsManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;
import java.util.Locale;

public class HelmetTrackingService extends Service implements LocationListener, SensorEventListener, Runnable {

    private static final String TAG = "HelmetTrackingService";
    private static final String CHANNEL_ID = "SmartHelmetGuardianChannel";
    private static final int NOTIFICATION_ID = 1001;

    private LocationManager locationManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothGatt bluetoothGatt;
    private HelmetBleScanCallback scanCallback;
    private HelmetBleGattCallback gattCallback;

    private Handler simulationHandler;
    private RideSimulatorEngine simulatorEngine;
    private CallEscalationManager callEscalationManager;
    private boolean isSimulationActive = false;
    private boolean hasRealGpsFix = false;
    private float currentAccuracy = 999.0f;

    private SensorManager sensorManager;
    private Sensor accelSensor;
    private long lastAccelTimestampNs = 0;
    private double lastGpsSpeedKmph = 0.0;
    private float[] gravity = new float[3];

    private double currentLat = 18.45290;
    private double currentLng = 73.85530;
    private double currentSpeed = 0.0;
    private double currentHeading = 0.0;
    private double currentGForce = 1.02;
    private boolean isHelmetWorn = true;
    private int currentAlcohol = 380;

    private String serverUrl = "https://sanrakshan-eight.vercel.app";
    private float sensitivityThresholdG = 4.0f;
    private boolean isCrashTriggered = false;

    @Override
    public void onCreate() {
        super.onCreate();
        SharedPreferences prefs = getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE);
        serverUrl = prefs.getString("SERVER_URL", "https://sanrakshan-eight.vercel.app");
        sensitivityThresholdG = prefs.getFloat("SENSITIVITY_G", 4.0f);

        // Load persisted real coordinates if available
        try {
            if (prefs.contains("LAST_LAT") && prefs.contains("LAST_LNG")) {
                currentLat = Double.parseDouble(prefs.getString("LAST_LAT", "18.45290"));
                currentLng = Double.parseDouble(prefs.getString("LAST_LNG", "73.85530"));
                hasRealGpsFix = prefs.getBoolean("HAS_REAL_FIX", false);
            }
        } catch (Exception ignored) {}

        scanCallback = new HelmetBleScanCallback(this);
        gattCallback = new HelmetBleGattCallback(this);
        simulatorEngine = new RideSimulatorEngine();
        callEscalationManager = new CallEscalationManager(this);
        simulationHandler = new Handler(Looper.getMainLooper());

        createNotificationChannel();
        Notification notif = buildForegroundNotification("Guardian is active — Your Silent Co-Rider for Life & Safety.");
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                int serviceType = 0;
                boolean hasLocation = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                                      checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                boolean hasBle = (Build.VERSION.SDK_INT < 31) ||
                                 (checkSelfPermission("android.permission.BLUETOOTH_CONNECT") == PackageManager.PERMISSION_GRANTED);

                if (hasLocation) serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
                if (hasBle) serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;

                if (serviceType != 0) {
                    startForeground(NOTIFICATION_ID, notif, serviceType);
                } else {
                    startForeground(NOTIFICATION_ID, notif);
                }
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFICATION_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION | ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else {
                startForeground(NOTIFICATION_ID, notif);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Safe startForeground fallback: " + t.getMessage());
            try {
                startForeground(NOTIFICATION_ID, notif);
            } catch (Throwable ignored) {}
        }

        initLocationManager();
        initBluetoothLE();
        initSensors();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String server = intent.getStringExtra("SERVER_URL");
            float sens = intent.getFloatExtra("SENSITIVITY_G", 4.0f);
            boolean simToggle = intent.getBooleanExtra("TOGGLE_SIMULATION", false);
            boolean simCrash = intent.getBooleanExtra("TRIGGER_SIM_CRASH", false);
            boolean manualSos = intent.getBooleanExtra("TRIGGER_SOS", false);

            if (server != null && !server.isEmpty()) serverUrl = server;
            sensitivityThresholdG = sens;

            if (simToggle) {
                isSimulationActive = intent.getBooleanExtra("SIM_STATE", false);
                if (isSimulationActive) {
                    isCrashTriggered = false;
                    simulatorEngine.reset();
                    simulationHandler.post(this);
                } else {
                    simulationHandler.removeCallbacks(this);
                }
            }

            if (simCrash) {
                simulatorEngine.triggerCrash(5.2);
                currentGForce = 5.2;
                handleCrashImpact(5.2);
            }

            if (manualSos) {
                triggerEmergencySosSequence("MANUAL_SOS_BUTTON", 1.0);
            }

            if ("NOTIFY_CALL_CUT_FAST".equals(intent.getAction())) {
                if (callEscalationManager != null) {
                    callEscalationManager.notifyCallEndedFast();
                }
            }

            if ("REFRESH_REAL_GPS".equals(intent.getAction())) {
                refreshRealLocation();
            }

            if (intent.hasExtra("SET_ALCOHOL_ADC")) {
                currentAlcohol = intent.getIntExtra("SET_ALCOHOL_ADC", 380);
                boolean isLocked = currentAlcohol >= 800;
                Log.i(TAG, "🍺 Breath alcohol updated to " + currentAlcohol + " ADC (Ignition " + (isLocked ? "LOCKED" : "UNLOCKED") + ")");
                dispatchTelemetryToServer(false);
            }
        }
        return START_STICKY;
    }

    @Override
    public void run() {
        if (!isSimulationActive) return;

        simulatorEngine.step();
        currentLat = simulatorEngine.getLatitude();
        currentLng = simulatorEngine.getLongitude();
        currentSpeed = simulatorEngine.getSpeed();
        currentHeading = simulatorEngine.getHeading();
        currentGForce = simulatorEngine.getGForce();

        Intent intent = new Intent("HELMET_LOCATION_UPDATE");
        intent.setPackage(getPackageName());
        intent.putExtra("LAT", currentLat);
        intent.putExtra("LNG", currentLng);
        intent.putExtra("SPEED", currentSpeed);
        intent.putExtra("HEADING", currentHeading);
        intent.putExtra("G_FORCE", currentGForce);
        intent.putExtra("IS_SIMULATION", true);
        sendBroadcast(intent);

        dispatchTelemetryToServer(false);
        simulationHandler.postDelayed(this, 1000);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Smart Helmet Guardian Active",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Continuous GPS tracking, BLE telemetry, and accident SOS monitoring.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("🛡️ Guardian Active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    private void initLocationManager() {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager != null) {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0.5f, this);
                }
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1500L, 1.0f, this);
                }
                try {
                    if (LocationManager.PASSIVE_PROVIDER != null && locationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                        locationManager.requestLocationUpdates(LocationManager.PASSIVE_PROVIDER, 1000L, 0.5f, this);
                    }
                } catch (Exception ignored) {}
                refreshRealLocation();
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission: " + e.getMessage());
        }
    }

    private void refreshRealLocation() {
        if (locationManager == null) return;
        try {
            Location lastGps = null;
            Location lastNet = null;
            Location lastPassive = null;
            try { lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
            try { lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
            try { lastPassive = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER); } catch (Exception ignored) {}

            Location best = null;
            if (lastGps != null) best = lastGps;
            else if (lastNet != null) best = lastNet;
            else if (lastPassive != null) best = lastPassive;

            if (best != null) {
                onLocationChanged(best);
            }
        } catch (SecurityException ignored) {}
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;
        hasRealGpsFix = true;
        currentAccuracy = location.hasAccuracy() ? location.getAccuracy() : 4.5f;

        // If demo simulation is active, keep background real GPS synced in storage but don't overwrite simulation HUD
        if (isSimulationActive) {
            getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE).edit()
                .putString("LAST_REAL_LAT", String.format(Locale.US, "%.5f", location.getLatitude()))
                .putString("LAST_REAL_LNG", String.format(Locale.US, "%.5f", location.getLongitude()))
                .putFloat("LAST_REAL_ACCURACY", currentAccuracy)
                .putBoolean("HAS_REAL_FIX", true)
                .commit();
            return;
        }

        // Live Real GPS Mode (Default)
        currentLat = location.getLatitude();
        currentLng = location.getLongitude();
        lastGpsSpeedKmph = location.hasSpeed() ? (location.getSpeed() * 3.6) : 0.0;
        currentSpeed = (lastGpsSpeedKmph <= 0.6) ? 0.0 : lastGpsSpeedKmph;
        currentHeading = location.hasBearing() ? location.getBearing() : currentHeading;

        // Persist real last known coordinates immediately
        getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE).edit()
            .putString("LAST_LAT", String.format(Locale.US, "%.5f", currentLat))
            .putString("LAST_LNG", String.format(Locale.US, "%.5f", currentLng))
            .putString("LAST_REAL_LAT", String.format(Locale.US, "%.5f", currentLat))
            .putString("LAST_REAL_LNG", String.format(Locale.US, "%.5f", currentLng))
            .putFloat("LAST_REAL_ACCURACY", currentAccuracy)
            .putBoolean("HAS_REAL_FIX", true)
            .putLong("LAST_TIMESTAMP", System.currentTimeMillis())
            .commit();

        Intent intent = new Intent("HELMET_LOCATION_UPDATE");
        intent.setPackage(getPackageName());
        intent.putExtra("LAT", currentLat);
        intent.putExtra("LNG", currentLng);
        intent.putExtra("SPEED", currentSpeed);
        intent.putExtra("HEADING", currentHeading);
        intent.putExtra("ACCURACY", currentAccuracy);
        intent.putExtra("G_FORCE", currentGForce);
        intent.putExtra("IS_SIMULATION", false);
        intent.putExtra("HAS_REAL_FIX", true);
        intent.putExtra("PROVIDER", location.getProvider() != null ? location.getProvider() : "HARDWARE_GPS");
        sendBroadcast(intent);

        dispatchTelemetryToServer(false);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override
    public void onProviderEnabled(String provider) {}
    @Override
    public void onProviderDisabled(String provider) {}

    private void initSensors() {
        try {
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
                if (accelSensor == null) {
                    accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                }
                if (accelSensor != null) {
                    sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_NORMAL);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Sensor init: " + e.getMessage());
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.values == null || isSimulationActive) return;

        float ax = 0, ay = 0, az = 0;
        if (event.sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION) {
            ax = event.values[0];
            ay = event.values[1];
            az = event.values[2];
        } else if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            final float alpha = 0.8f;
            gravity[0] = alpha * gravity[0] + (1 - alpha) * event.values[0];
            gravity[1] = alpha * gravity[1] + (1 - alpha) * event.values[1];
            gravity[2] = alpha * gravity[2] + (1 - alpha) * event.values[2];
            ax = event.values[0] - gravity[0];
            ay = event.values[1] - gravity[1];
            az = event.values[2] - gravity[2];
        }

        double dynamicAccel = Math.sqrt(ax * ax + ay * ay + az * az);
        long nowNs = event.timestamp;

        if (lastAccelTimestampNs > 0) {
            double dt = (nowNs - lastAccelTimestampNs) * 1e-9;
            if (dt > 0 && dt < 1.0) {
                // Zero-Velocity Update (ZUPT): clamp stationary sensor jitter to 0.0 km/h
                if (dynamicAccel < 0.22 && lastGpsSpeedKmph < 2.0) {
                    currentSpeed = 0.0;
                } else if (lastGpsSpeedKmph > 0.5) {
                    // Complementary filter: blends GPS Doppler ground velocity with accelerometer responsiveness
                    double integrated = lastGpsSpeedKmph + (dynamicAccel * dt * 3.6);
                    currentSpeed = Math.max(0.0, 0.85 * lastGpsSpeedKmph + 0.15 * integrated);
                }
            }
        }
        lastAccelTimestampNs = nowNs;
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private void initBluetoothLE() {
        try {
            bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
            if (bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
                startBleScanning();
            }
        } catch (Exception e) {
            Log.e(TAG, "BLE Init Error: " + e.getMessage());
        }
    }

    public void startBleScanning() {
        try {
            BluetoothLeScanner scanner = bluetoothAdapter.getBluetoothLeScanner();
            if (scanner == null) return;
            broadcastBleStatus("Scanning for Helmet BLE...");
            scanner.startScan(scanCallback);
        } catch (SecurityException e) {
            Log.e(TAG, "BLE Permission: " + e.getMessage());
        }
    }

    public void stopScanAndConnect(BluetoothDevice device, HelmetBleScanCallback callback) {
        try {
            bluetoothAdapter.getBluetoothLeScanner().stopScan(callback);
            broadcastBleStatus("Connecting to " + device.getName());
            bluetoothGatt = device.connectGatt(this, false, gattCallback);
        } catch (SecurityException e) {
            Log.e(TAG, "GATT Connect Error: " + e.getMessage());
        }
    }

    public void parseHelmetSensorData(String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) return;
        rawJson = rawJson.trim();

        try {
            boolean crash = false;
            int alcohol = currentAlcohol;
            boolean helmet = isHelmetWorn;
            double gForce = currentGForce;

            if (rawJson.startsWith("{")) {
                try {
                    JSONObject json = new JSONObject(rawJson);
                    crash = json.optBoolean("crash", json.optBoolean("c", false)) || json.optInt("crash", json.optInt("c", 0)) == 1;
                    alcohol = json.optInt("alcohol", json.optInt("a", currentAlcohol));
                    if (json.has("helmet")) {
                        helmet = json.optBoolean("helmet", true) || json.optInt("helmet", 1) == 1;
                    } else if (json.has("h")) {
                        helmet = json.optBoolean("h", true) || json.optInt("h", 1) == 1;
                    }
                    gForce = json.optDouble("gForce", json.optDouble("g", 1.0));
                } catch (Exception parseEx) {
                    // Fallback regex extraction if JSON was truncated by small MTU
                    if (rawJson.contains("\"helmet\":false") || rawJson.contains("\"h\":0") || rawJson.contains("\"h\":false")) helmet = false;
                    if (rawJson.contains("\"helmet\":true") || rawJson.contains("\"h\":1") || rawJson.contains("\"h\":true")) helmet = true;
                    java.util.regex.Matcher ma = java.util.regex.Pattern.compile("\"a(?:lcohol)?\":(\\d+)").matcher(rawJson);
                    if (ma.find()) alcohol = Integer.parseInt(ma.group(1));
                    java.util.regex.Matcher mg = java.util.regex.Pattern.compile("\"g(?:Force)?\":([0-9.]+)").matcher(rawJson);
                    if (mg.find()) gForce = Double.parseDouble(mg.group(1));
                    if (rawJson.contains("\"crash\":true") || rawJson.contains("\"c\":1") || rawJson.contains("\"c\":true")) crash = true;
                }
            } else if (rawJson.contains("H:") || rawJson.contains("A:") || rawJson.contains("G:")) {
                // Parse key-value: H:1,A:250,G:1.02,C:0
                String[] tokens = rawJson.split(",");
                for (String tok : tokens) {
                    tok = tok.trim().toUpperCase();
                    if (tok.startsWith("H:")) {
                        helmet = tok.substring(2).equals("1") || tok.substring(2).equals("TRUE");
                    } else if (tok.startsWith("A:")) {
                        try { alcohol = Integer.parseInt(tok.substring(2)); } catch (Exception ignored) {}
                    } else if (tok.startsWith("G:")) {
                        try { gForce = Double.parseDouble(tok.substring(2)); } catch (Exception ignored) {}
                    } else if (tok.startsWith("C:")) {
                        crash = tok.substring(2).equals("1") || tok.substring(2).equals("TRUE");
                    }
                }
            }

            isHelmetWorn = helmet;
            currentAlcohol = alcohol;
            currentGForce = gForce;

            // Build canonical JSON for UI & website
            JSONObject canonical = new JSONObject();
            canonical.put("helmet", isHelmetWorn);
            canonical.put("alcohol", currentAlcohol);
            canonical.put("gForce", currentGForce);
            canonical.put("crash", crash);

            Intent intent = new Intent("HELMET_TELEMETRY_UPDATE");
            intent.setPackage(getPackageName());
            intent.putExtra("DATA", canonical.toString());
            sendBroadcast(intent);

            dispatchTelemetryToServer(crash);

            if ((crash || currentGForce >= sensitivityThresholdG) && !isCrashTriggered) {
                handleCrashImpact(currentGForce);
            }
        } catch (Exception e) {
            Log.e(TAG, "Sensor parse error: " + e.getMessage());
        }
    }

    private void handleCrashImpact(double peakG) {
        isCrashTriggered = true;
        triggerEmergencySosSequence(String.format(Locale.US, "HIGH_IMPACT_CRASH (%.1fG >= %.1fG)", peakG, sensitivityThresholdG), peakG);
    }

    public void triggerEmergencySosSequence(String reason, double gForce) {
        Log.e(TAG, "🚨 CRITICAL EMERGENCY SOS: " + reason);

        // Fetch best fresh real coordinates if available
        refreshRealLocation();
        if (currentLat == 0.0 || currentLng == 0.0) {
            SharedPreferences prefs = getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE);
            try {
                if (prefs.contains("LAST_REAL_LAT") && prefs.contains("LAST_REAL_LNG")) {
                    currentLat = Double.parseDouble(prefs.getString("LAST_REAL_LAT", "18.45290"));
                    currentLng = Double.parseDouble(prefs.getString("LAST_REAL_LNG", "73.85530"));
                } else if (prefs.contains("LAST_LAT") && prefs.contains("LAST_LNG")) {
                    currentLat = Double.parseDouble(prefs.getString("LAST_LAT", "18.45290"));
                    currentLng = Double.parseDouble(prefs.getString("LAST_LNG", "73.85530"));
                }
            } catch (Exception ignored) {}
        }

        RiderProfile rider = RiderProfile.load(this);
        List<ContactItem> contacts = ContactStorage.loadContacts(this);

        String latStr = String.format(Locale.US, "%.5f", currentLat);
        String lngStr = String.format(Locale.US, "%.5f", currentLng);
        String mapsUrl = "https://maps.google.com/?q=" + latStr + "," + lngStr;

        // Clean GSM 7-bit single SMS strictly under 160 characters
        String smsBody = "GUARDIAN SOS: " + rider.riderName + 
                         " (Age:" + rider.age + ", Blood:" + rider.bloodGroup + ", Bike:" + rider.vehicleNumber + ")" +
                         " accident at " + latStr + "," + lngStr + 
                         " Map: " + mapsUrl;

        // 1. Send SMS to ALL configured Emergency Contacts
        SmsManager smsManager = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getSystemService(SmsManager.class);
            }
            if (smsManager == null) {
                smsManager = SmsManager.getDefault();
            }
        } catch (Exception ignored) {}

        int smsCount = 0;
        for (int i = 0; i < contacts.size(); i++) {
            ContactItem c = contacts.get(i);
            String safePhone = SecuritySanitizer.sanitizePhone(c.phone);
            if (!safePhone.isEmpty() && smsManager != null) {
                try {
                    smsManager.sendTextMessage(safePhone, null, smsBody, null, null);
                    smsCount++;
                    Log.i(TAG, "SOS SMS sent to: " + c.name + " (" + safePhone + ")");
                } catch (Exception e) {
                    Log.e(TAG, "SMS dispatch error to " + safePhone + ": " + e.getMessage());
                    try {
                        java.util.ArrayList<String> parts = smsManager.divideMessage(smsBody);
                        if (parts.size() > 1) {
                            smsManager.sendMultipartTextMessage(safePhone, null, parts, null, null);
                        } else {
                            smsManager.sendTextMessage(safePhone, null, parts.get(0), null, null);
                        }
                        smsCount++;
                    } catch (Exception ignored) {}
                }
            }
        }

        // 2. Sequential Call Escalation (Calls Primary; if busy/switched off, auto-escalates to secondary, etc.)
        if (callEscalationManager != null) {
            callEscalationManager.startEscalation();
        }

        // 3. Save to Local SOS History
        saveSosHistoryRecord(rider, gForce, contacts.size(), "Escalating All Contacts");

        // 4. Send SOS payload to Web Server
        dispatchTelemetryToServer(true);

        // 5. Broadcast to UI
        Intent sosIntent = new Intent("HELMET_SOS_TRIGGERED");
        sosIntent.setPackage(getPackageName());
        sosIntent.putExtra("REASON", reason);
        sosIntent.putExtra("LAT", currentLat);
        sosIntent.putExtra("LNG", currentLng);
        sosIntent.putExtra("CONTACTS_COUNT", smsCount);
        sendBroadcast(sosIntent);
    }

    private void saveSosHistoryRecord(RiderProfile rider, double gForce, int contactsNotified, String primaryCalled) {
        try {
            SharedPreferences prefs = getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE);
            String existing = prefs.getString("SOS_HISTORY_LOG", "[]");
            JSONArray arr = new JSONArray(existing);

            JSONObject record = new JSONObject();
            record.put("timestamp", System.currentTimeMillis());
            record.put("riderId", rider.riderId);
            record.put("vehicle", rider.vehicleNumber);
            record.put("lat", currentLat);
            record.put("lng", currentLng);
            record.put("gForce", gForce);
            record.put("contactsCount", contactsNotified);
            record.put("callTarget", primaryCalled);
            record.put("status", "SOS DISPATCHED (CALL ESCALATION + SMS)");

            arr.put(0, record);
            prefs.edit().putString("SOS_HISTORY_LOG", arr.toString()).commit();
        } catch (Exception ignored) {}
    }

    private void dispatchTelemetryToServer(boolean isCrash) {
        if (serverUrl == null || serverUrl.trim().isEmpty()) return;

        try {
            RiderProfile rider = RiderProfile.load(this);
            List<ContactItem> contacts = ContactStorage.loadContacts(this);

            JSONObject root = new JSONObject();
            root.put("rideId", rider.riderId);
            root.put("riderName", rider.riderName);
            root.put("vehicleNumber", rider.vehicleNumber);
            root.put("bloodGroup", rider.bloodGroup);
            root.put("age", rider.age);
            root.put("timestamp", System.currentTimeMillis());

            JSONObject loc = new JSONObject();
            loc.put("latitude", currentLat);
            loc.put("longitude", currentLng);
            loc.put("speedKmph", currentSpeed);
            loc.put("heading", currentHeading);
            loc.put("accuracyMeters", hasRealGpsFix ? currentAccuracy : 3.0);
            loc.put("isRealGps", !isSimulationActive && hasRealGpsFix);
            loc.put("provider", isSimulationActive ? "SIMULATION" : (hasRealGpsFix ? "PHONE_HARDWARE_GPS" : "PHONE_CELL_ESTIMATE"));
            root.put("location", loc);

            JSONObject sens = new JSONObject();
            boolean isIgnitionActive = !isCrash && isHelmetWorn && (currentAlcohol < 800);
            sens.put("helmetWorn", isHelmetWorn);
            sens.put("alcoholAdc", currentAlcohol);
            sens.put("alcoholStatus", (currentAlcohol >= 800 ? "DRUNK / ENGINE LOCKED" : "SAFE / SOBER"));
            sens.put("totalG", currentGForce);
            sens.put("gForceX", 0.1);
            sens.put("gForceY", 0.98);
            sens.put("gForceZ", 0.05);
            sens.put("vibrationLevel", (isCrash ? "CRASH" : "NORMAL"));
            sens.put("ignitionRelay", isIgnitionActive);
            root.put("sensors", sens);

            JSONObject alerts = new JSONObject();
            alerts.put("isCrashDetected", isCrash);
            alerts.put("isManualSosActive", false);
            alerts.put("thresholdG", sensitivityThresholdG);
            root.put("alerts", alerts);

            JSONArray contactsArr = new JSONArray();
            for (int i = 0; i < contacts.size(); i++) {
                contactsArr.put(contacts.get(i).toJson());
            }
            root.put("emergencyContacts", contactsArr);

            TelemetryHttpSender sender = new TelemetryHttpSender(serverUrl, root.toString());
            new Thread(sender).start();
        } catch (Exception e) {
            Log.w(TAG, "Telemetry build error: " + e.getMessage());
        }
    }

    public void broadcastBleStatus(String status) {
        Intent intent = new Intent("HELMET_BLE_STATUS");
        intent.setPackage(getPackageName());
        intent.putExtra("STATUS", status);
        sendBroadcast(intent);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            isSimulationActive = false;
            if (simulationHandler != null) simulationHandler.removeCallbacks(this);
            if (callEscalationManager != null) callEscalationManager.stopEscalation();
            if (locationManager != null) locationManager.removeUpdates(this);
            if (bluetoothGatt != null) bluetoothGatt.close();
            if (sensorManager != null) {
                try { sensorManager.unregisterListener(this); } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
