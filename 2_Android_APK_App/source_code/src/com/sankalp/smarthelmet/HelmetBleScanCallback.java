package com.sankalp.smarthelmet;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.os.ParcelUuid;
import android.util.Log;
import java.util.List;
import java.util.UUID;

public class HelmetBleScanCallback extends ScanCallback {
    private static final String TAG = "HelmetBleScan";
    private static final UUID TARGET_SERVICE_UUID = UUID.fromString("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
    private HelmetTrackingService service;

    public HelmetBleScanCallback(HelmetTrackingService service) {
        this.service = service;
    }

    @Override
    public void onScanResult(int callbackType, ScanResult result) {
        if (result == null) return;
        BluetoothDevice device = result.getDevice();
        ScanRecord record = result.getScanRecord();

        String devName = null;
        if (device != null) {
            try {
                devName = device.getName();
            } catch (SecurityException ignored) {}
        }
        if (devName == null && record != null) {
            devName = record.getDeviceName();
        }

        boolean nameMatch = false;
        if (devName != null) {
            String lower = devName.toLowerCase();
            nameMatch = lower.contains("guardian") || lower.contains("helmet") || 
                        lower.contains("esp32") || lower.contains("sankalp");
        }

        boolean uuidMatch = false;
        if (record != null) {
            List<ParcelUuid> uuids = record.getServiceUuids();
            if (uuids != null) {
                for (ParcelUuid pu : uuids) {
                    if (pu != null && TARGET_SERVICE_UUID.equals(pu.getUuid())) {
                        uuidMatch = true;
                        break;
                    }
                }
            }
        }

        if ((nameMatch || uuidMatch) && device != null) {
            Log.i(TAG, "Found target Helmet BLE device: " + (devName != null ? devName : device.getAddress()));
            service.stopScanAndConnect(device, this);
        }
    }

    @Override
    public void onScanFailed(int errorCode) {
        Log.e(TAG, "BLE Scan failed with error code: " + errorCode);
    }
}
