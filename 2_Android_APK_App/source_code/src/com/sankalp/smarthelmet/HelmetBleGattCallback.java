package com.sankalp.smarthelmet;

import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothProfile;
import java.util.UUID;

public class HelmetBleGattCallback extends BluetoothGattCallback {
    private HelmetTrackingService service;
    private static final UUID BLE_SERVICE_UUID = UUID.fromString("4fafc201-1fb5-459e-8fcc-c5c9c331914b");

    public HelmetBleGattCallback(HelmetTrackingService service) {
        this.service = service;
    }

    @Override
    public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
            service.broadcastBleStatus("Connected to " + gatt.getDevice().getName());
            try {
                gatt.discoverServices();
            } catch (SecurityException ignored) {}
        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
            service.broadcastBleStatus("Disconnected. Auto-reconnecting...");
            service.startBleScanning();
        }
    }

    @Override
    public void onServicesDiscovered(BluetoothGatt gatt, int status) {
        try {
            for (BluetoothGattCharacteristic ch : gatt.getService(BLE_SERVICE_UUID).getCharacteristics()) {
                gatt.setCharacteristicNotification(ch, true);
                BluetoothGattDescriptor descriptor = ch.getDescriptor(UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"));
                if (descriptor != null) {
                    descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    gatt.writeDescriptor(descriptor);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
        byte[] data = characteristic.getValue();
        if (data != null) {
            service.parseHelmetSensorData(new String(data));
        }
    }

    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value) {
        if (value != null) {
            service.parseHelmetSensorData(new String(value));
        }
    }
}
