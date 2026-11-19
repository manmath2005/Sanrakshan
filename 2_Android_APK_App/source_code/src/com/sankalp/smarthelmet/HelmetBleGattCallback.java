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
            String name = "ESP32 Helmet";
            try {
                if (gatt.getDevice() != null && gatt.getDevice().getName() != null) {
                    name = gatt.getDevice().getName();
                }
            } catch (SecurityException ignored) {}
            service.broadcastBleStatus("Connected to " + name + " ✅");
            Log.i(TAG, "Connected to GATT server: " + name);

            // Request larger MTU (512 bytes) to guarantee JSON packets are never truncated
            boolean mtuRequested = false;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    mtuRequested = gatt.requestMtu(512);
                    Log.i(TAG, "Requesting MTU 512: " + mtuRequested);
                }
            } catch (SecurityException ignored) {}

            if (!mtuRequested) {
                try {
                    gatt.discoverServices();
                } catch (SecurityException ignored) {}
            }
        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
            service.broadcastBleStatus("Disconnected. Auto-reconnecting... 📡");
            Log.w(TAG, "Disconnected from GATT server.");
            service.startBleScanning();
        }
    }

    @Override
    public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
        Log.i(TAG, "MTU changed to: " + mtu + " (status: " + status + ")");
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
                }
            } else {
                // If specific UUID not found, check all characteristics
                for (BluetoothGattService s : gatt.getServices()) {
                    for (BluetoothGattCharacteristic ch : s.getCharacteristics()) {
                        if ((ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0) {
                            enableNotifications(gatt, ch);
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
                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                boolean descWritten = gatt.writeDescriptor(descriptor);
                Log.i(TAG, "writeDescriptor for 2902: " + descWritten);
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Permission error enabling notification: " + e.getMessage());
        }
    }

    @Override
    public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
        Log.i(TAG, "Descriptor write complete: status=" + status);
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
