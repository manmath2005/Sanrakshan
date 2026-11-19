package com.sankalp.smarthelmet;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;

public class HelmetBleScanCallback extends ScanCallback {
    private HelmetTrackingService service;

    public HelmetBleScanCallback(HelmetTrackingService service) {
        this.service = service;
    }

    @Override
    public void onScanResult(int callbackType, ScanResult result) {
        BluetoothDevice device = result.getDevice();
        if (device != null && device.getName() != null) {
            String name = device.getName().toLowerCase();
            if (name.contains("guardian") || name.contains("helmet") || name.contains("esp32") || name.contains("sankalp")) {
                service.stopScanAndConnect(device, this);
            }
        }
    }
}
