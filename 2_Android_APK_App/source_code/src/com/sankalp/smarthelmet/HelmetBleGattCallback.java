package com.sankalp.smarthelmet;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.util.UUID;

public class HelmetBleGattCallback extends BluetoothGattCallback {
    private static final String TAG = "HelmetBleGatt";
    private final HelmetTrackingService service;

    // UUIDs must match Guardian_Transmitter_Helmet ESP32 firmware exactly
    private static final UUID BLE_SERVICE_UUID        = UUID.fromString("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
    private static final UUID BLE_CHARACTERISTIC_UUID = UUID.fromString("beb5483e-36e1-4688-b7f5-ea07361b26a8");
    private static final UUID CLIENT_CONFIG_DESCRIPTOR = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private BluetoothGatt activeGatt;
    private boolean servicesDiscovered = false;

    public HelmetBleGattCallback(HelmetTrackingService service) {
        this.service = service;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CONNECTION STATE — fires when phone connects/disconnects from ESP32
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
        Log.i(TAG, "onConnectionStateChange: status=" + status + " newState=" + newState);

        if (newState == BluetoothProfile.STATE_CONNECTED) {
            activeGatt = gatt;
            servicesDiscovered = false;
            service.setBleConnected(true);

            String name = "Guardian_Helmet";
            try {
                if (gatt.getDevice() != null && gatt.getDevice().getName() != null) {
                    name = gatt.getDevice().getName();
                }
            } catch (SecurityException ignored) {}
            service.broadcastBleStatus("Connected to " + name + " ✅ — discovering services...");
            Log.i(TAG, "GATT connected to: " + name);

            // ★ CORRECT ORDER: requestMtu FIRST (Android docs say do this right after connect)
            // discoverServices will be called from onMtuChanged once MTU negotiation completes.
            // This avoids the race condition of running both simultaneously.
            try {
                boolean mtuReq = gatt.requestMtu(185); // 185 fits our JSON + header with margin
                Log.i(TAG, "requestMtu(185) returned: " + mtuReq);
                if (!mtuReq) {
                    // If requestMtu fails (older Android), discover services directly
                    discoverServicesNow(gatt);
                }
            } catch (SecurityException e) {
                Log.e(TAG, "SecurityException requestMtu: " + e.getMessage());
                discoverServicesNow(gatt);
            }

        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
            Log.w(TAG, "GATT Disconnected (status=" + status + "). Restarting BLE scan...");
            servicesDiscovered = false;
            activeGatt = null;
            service.setBleConnected(false);
            service.broadcastBleStatus("Disconnected — scanning for Guardian_Helmet... 📡");

            // Close GATT to free resources, then restart scanning
            try { gatt.close(); } catch (Exception ignored) {}

            // Restart scanning after a brief pause to allow BT stack to settle
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                service.startBleScanning();
            }, 1500);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. MTU CHANGED — fires after MTU negotiation completes
    //    ★ THIS IS THE RIGHT PLACE to call discoverServices (not onConnectionStateChange)
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
        Log.i(TAG, "MTU negotiated: " + mtu + " bytes (status=" + status + ")");
        // Now safe to discover services — MTU is set, no race condition
        discoverServicesNow(gatt);
    }

    private void discoverServicesNow(BluetoothGatt gatt) {
        if (servicesDiscovered) return; // Guard against double-discovery
        try {
            boolean disc = gatt.discoverServices();
            Log.i(TAG, "discoverServices() called, returned: " + disc);
        } catch (SecurityException e) {
            Log.e(TAG, "SecurityException discoverServices: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. SERVICES DISCOVERED — register for NOTIFY on our characteristic
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onServicesDiscovered(BluetoothGatt gatt, int status) {
        Log.i(TAG, "onServicesDiscovered status=" + status);
        if (status != BluetoothGatt.GATT_SUCCESS) {
            Log.e(TAG, "Service discovery failed! status=" + status + ". Will retry scan.");
            service.startBleScanning();
            return;
        }
        servicesDiscovered = true;

        try {
            // Try our specific service UUID first
            BluetoothGattService targetService = gatt.getService(BLE_SERVICE_UUID);
            BluetoothGattCharacteristic targetChar = null;

            if (targetService != null) {
                targetChar = targetService.getCharacteristic(BLE_CHARACTERISTIC_UUID);
                if (targetChar == null && !targetService.getCharacteristics().isEmpty()) {
                    // Fallback: take first characteristic in the service
                    targetChar = targetService.getCharacteristics().get(0);
                    Log.w(TAG, "Specific char UUID not found, using first char: " + targetChar.getUuid());
                }
            } else {
                Log.w(TAG, "Target service UUID not found — scanning all services for NOTIFY/READ char");
                // Fallback: search all services
                for (BluetoothGattService s : gatt.getServices()) {
                    for (BluetoothGattCharacteristic ch : s.getCharacteristics()) {
                        boolean hasNotify = (ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0;
                        boolean hasRead   = (ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) != 0;
                        if (hasNotify || hasRead) {
                            targetChar = ch;
                            break;
                        }
                    }
                    if (targetChar != null) break;
                }
            }

            if (targetChar != null) {
                Log.i(TAG, "Target characteristic found: " + targetChar.getUuid());
                enableNotificationsAndRead(gatt, targetChar);
            } else {
                Log.e(TAG, "No suitable BLE characteristic found on ESP32!");
            }
        } catch (Exception e) {
            Log.e(TAG, "onServicesDiscovered exception: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ENABLE NOTIFICATIONS — the ONLY correct way to subscribe to ESP32 notify
    // ─────────────────────────────────────────────────────────────────────────
    private void enableNotificationsAndRead(BluetoothGatt gatt, BluetoothGattCharacteristic ch) {
        try {
            // Step A: Tell the Android BLE stack to deliver notifications to our callback
            boolean notifyEnabled = gatt.setCharacteristicNotification(ch, true);
            Log.i(TAG, "setCharacteristicNotification=" + notifyEnabled + " for " + ch.getUuid());

            // Step B: Write 0x0001 to the CCCD descriptor on the ESP32 — this is what actually
            // tells the ESP32 to START sending notify packets. Without this, ESP32 notify() does nothing.
            BluetoothGattDescriptor cccd = ch.getDescriptor(CLIENT_CONFIG_DESCRIPTOR);
            if (cccd != null) {
                if (Build.VERSION.SDK_INT >= 33) {
                    // Android 13+ API — synchronous, correct way
                    int writeResult = gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    Log.i(TAG, "writeDescriptor (API33+) queued, result=" + writeResult);
                } else {
                    // Android 12 and below — legacy API
                    cccd.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    boolean descWrite = gatt.writeDescriptor(cccd);
                    Log.i(TAG, "writeDescriptor (legacy) queued=" + descWrite);
                }
            } else {
                Log.w(TAG, "CCCD (0x2902) descriptor not found on characteristic — ESP32 notify may not work!");
                // If no CCCD, do a direct read immediately as fallback
                doSingleRead(gatt, ch);
            }
        } catch (SecurityException e) {
            Log.e(TAG, "SecurityException enabling notifications: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. DESCRIPTOR WRITE COMPLETE — do ONE read to get the initial value immediately
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
        Log.i(TAG, "onDescriptorWrite: status=" + status + " descriptor=" + descriptor.getUuid());
        if (status == BluetoothGatt.GATT_SUCCESS) {
            service.setBleConnected(true);
            service.broadcastBleStatus("Guardian_Helmet BLE LIVE ✅ — streaming telemetry");
            Log.i(TAG, "✅ Notifications fully subscribed. ESP32 will now push sensor data.");
            // Do ONE immediate read to get the first packet without waiting for a notify
            doSingleRead(gatt, descriptor.getCharacteristic());
        } else {
            Log.e(TAG, "Descriptor write FAILED (status=" + status + ") — notifications NOT active!");
            // Retry once after a short delay
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    BluetoothGattCharacteristic ch = descriptor.getCharacteristic();
                    if (ch != null) enableNotificationsAndRead(gatt, ch);
                } catch (Exception ignored) {}
            }, 1000);
        }
    }

    private void doSingleRead(BluetoothGatt gatt, BluetoothGattCharacteristic ch) {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (ch != null) {
                    boolean ok = gatt.readCharacteristic(ch);
                    Log.d(TAG, "Initial readCharacteristic triggered=" + ok);
                }
            } catch (SecurityException ignored) {}
        }, 300);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. CHARACTERISTIC CHANGED — fires on each ESP32 notify() call (~6Hz)
    //    ★ BOTH overloads needed: legacy (pre-API33) and new (API33+)
    //    ★ The API33+ overload MUST have @Override — Android only calls it via reflection
    // ─────────────────────────────────────────────────────────────────────────

    // Legacy callback — Android 12 and below
    @Override
    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
        byte[] data = characteristic.getValue();
        if (data != null && data.length > 0) {
            String str = new String(data).trim();
            Log.d(TAG, "notify (legacy/API<33): " + str);
            service.parseHelmetSensorData(str);
        }
    }

    // New callback — Android 13+ (API 33+). @Override is REQUIRED for the system to call it.
    @Override
    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value) {
        if (value != null && value.length > 0) {
            String str = new String(value).trim();
            Log.d(TAG, "notify (API33+): " + str);
            service.parseHelmetSensorData(str);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CHARACTERISTIC READ — fires after readCharacteristic() completes
    // ─────────────────────────────────────────────────────────────────────────

    // Legacy read callback — Android 12 and below
    @Override
    public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
        if (status == BluetoothGatt.GATT_SUCCESS) {
            byte[] data = characteristic.getValue();
            if (data != null && data.length > 0) {
                String str = new String(data).trim();
                Log.d(TAG, "read (legacy): " + str);
                service.parseHelmetSensorData(str);
            }
        } else {
            Log.w(TAG, "onCharacteristicRead failed status=" + status);
        }
    }

    // New read callback — Android 13+ (API 33+). @Override is REQUIRED.
    @Override
    public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
        if (status == BluetoothGatt.GATT_SUCCESS && value != null && value.length > 0) {
            String str = new String(value).trim();
            Log.d(TAG, "read (API33+): " + str);
            service.parseHelmetSensorData(str);
        }
    }
}
