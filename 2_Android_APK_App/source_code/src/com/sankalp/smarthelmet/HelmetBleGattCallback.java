package com.sankalp.smarthelmet;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.os.Build;
import android.util.Log;
import java.util.UUID;

public class HelmetBleGattCallback extends BluetoothGattCallback {
    private static final String TAG = "HelmetBleGatt";
    private HelmetTrackingService service;
    private static final UUID BLE_SERVICE_UUID = UUID.fromString("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
    private static final UUID CLIENT_CONFIG_DESCRIPTOR = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    public HelmetBleGattCallback(HelmetTrackingService service) {
        this.service = service;
    }

    @Override
    public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
            service.setBleConnected(true);
            String name = "ESP32 Helmet";
            try {
                if (gatt.getDevice() != null && gatt.getDevice().getName() != null) {
                    name = gatt.getDevice().getName();
                }
            } catch (SecurityException ignored) {}
            service.broadcastBleStatus("Connected to " + name + " ✅");
            Log.i(TAG, "Connected to GATT server: " + name);

            // 1. Immediately schedule discoverServices (never block it behind MTU exchange)
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    boolean disc = gatt.discoverServices();
                    Log.i(TAG, "gatt.discoverServices() returned: " + disc);
                } catch (SecurityException e) {
                    Log.e(TAG, "SecurityException during discoverServices: " + e.getMessage());
                }
            }, 300);

            // 2. Request MTU 512 in parallel
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    gatt.requestMtu(512);
                }
            } catch (SecurityException ignored) {}
        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
            service.setBleConnected(false);
            service.stopActiveGattPolling();
            service.broadcastBleStatus("Disconnected. Auto-reconnecting... 📡");
            Log.w(TAG, "Disconnected from GATT server.");
            service.startBleScanning();
        }
    }

    @Override
    public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
        Log.i(TAG, "MTU changed to: " + mtu + " (status: " + status + ")");
        // Re-discover services if not already discovered
        try {
            gatt.discoverServices();
        } catch (SecurityException ignored) {}
    }

    @Override
    public void onServicesDiscovered(BluetoothGatt gatt, int status) {
        Log.i(TAG, "Services discovered with status: " + status);
        if (status != BluetoothGatt.GATT_SUCCESS) {
            return;
        }

        try {
            BluetoothGattService targetService = gatt.getService(BLE_SERVICE_UUID);
            if (targetService != null) {
                for (BluetoothGattCharacteristic ch : targetService.getCharacteristics()) {
                    enableNotifications(gatt, ch);
                    service.startActiveGattPolling(gatt, ch);
                }
            } else {
                // If specific UUID not found, check all characteristics
                for (BluetoothGattService s : gatt.getServices()) {
                    for (BluetoothGattCharacteristic ch : s.getCharacteristics()) {
                        if ((ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0 ||
                            (ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) != 0) {
                            enableNotifications(gatt, ch);
                            service.startActiveGattPolling(gatt, ch);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring notifications: " + e.getMessage());
        }
    }

    private void enableNotifications(BluetoothGatt gatt, BluetoothGattCharacteristic ch) {
        try {
            boolean notifySet = gatt.setCharacteristicNotification(ch, true);
            Log.i(TAG, "setCharacteristicNotification for " + ch.getUuid() + ": " + notifySet);

            BluetoothGattDescriptor descriptor = ch.getDescriptor(CLIENT_CONFIG_DESCRIPTOR);
            if (descriptor != null) {
                if (Build.VERSION.SDK_INT >= 33) {
                    try {
                        gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                        Log.i(TAG, "writeDescriptor API 33+ for 2902 queued.");
                    } catch (Throwable t) {
                        descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                        gatt.writeDescriptor(descriptor);
                    }
                } else {
                    descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    gatt.writeDescriptor(descriptor);
                    Log.i(TAG, "writeDescriptor legacy for 2902 queued.");
                }
            }

            // Also read characteristic once immediately
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    gatt.readCharacteristic(ch);
                } catch (SecurityException ignored) {}
            }, 600);
        } catch (SecurityException e) {
            Log.e(TAG, "Permission error enabling notification: " + e.getMessage());
        }
    }

    @Override
    public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
        if (status == BluetoothGatt.GATT_SUCCESS) {
            byte[] data = characteristic.getValue();
            if (data != null && data.length > 0) {
                String str = new String(data);
                Log.d(TAG, "Telemetry read (legacy): " + str);
                service.parseHelmetSensorData(str);
            }
        }
    }

    public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
        if (status == BluetoothGatt.GATT_SUCCESS && value != null && value.length > 0) {
            String str = new String(value);
            Log.d(TAG, "Telemetry read (API 33+): " + str);
            service.parseHelmetSensorData(str);
        }
    }

    @Override
    public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
        Log.i(TAG, "Descriptor write complete: status=" + status);
        if (status == BluetoothGatt.GATT_SUCCESS) {
            service.setBleConnected(true);
            try {
                if (descriptor != null && descriptor.getCharacteristic() != null) {
                    gatt.readCharacteristic(descriptor.getCharacteristic());
                }
            } catch (SecurityException ignored) {}
        }
    }

    @Override
    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
        byte[] data = characteristic.getValue();
        if (data != null && data.length > 0) {
            String str = new String(data);
            Log.d(TAG, "Telemetry received (legacy): " + str);
            service.parseHelmetSensorData(str);
        }
    }

    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value) {
        if (value != null && value.length > 0) {
            String str = new String(value);
            Log.d(TAG, "Telemetry received (API 33+): " + str);
            service.parseHelmetSensorData(str);
        }
    }
}
