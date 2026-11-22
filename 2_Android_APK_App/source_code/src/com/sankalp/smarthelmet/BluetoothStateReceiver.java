package com.sankalp.smarthelmet;

import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class BluetoothStateReceiver extends BroadcastReceiver implements Runnable {
    private static final String TAG = "BluetoothStateReceiver";
    private final HelmetTrackingService service;

    public BluetoothStateReceiver(HelmetTrackingService service) {
        this.service = service;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (service == null || intent == null) return;

        String action = intent.getAction();
        if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {
            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            if (state == BluetoothAdapter.STATE_ON) {
                Log.i(TAG, "Bluetooth turned ON -> Auto-reconnecting to Helmet BLE...");
                service.broadcastBleStatus("Bluetooth ON. Auto-connecting to Helmet... 📡");
                new Handler(Looper.getMainLooper()).postDelayed(this, 800);
            } else if (state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF) {
                Log.w(TAG, "Bluetooth turned OFF -> Resetting BLE connection state.");
                service.setBleConnected(false);
                service.broadcastBleStatus("Bluetooth is OFF. Turn ON Bluetooth to reconnect.");
            }
        }
    }

    @Override
    public void run() {
        if (service != null) {
            service.connectToSavedDeviceOrScan();
        }
    }
}
