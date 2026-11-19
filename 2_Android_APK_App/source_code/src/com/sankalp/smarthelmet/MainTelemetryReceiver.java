package com.sankalp.smarthelmet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class MainTelemetryReceiver extends BroadcastReceiver {

    private MainActivity activity;

    public MainTelemetryReceiver(MainActivity activity) {
        this.activity = activity;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (activity == null || intent == null) return;

        String action = intent.getAction();
        if ("HELMET_LOCATION_UPDATE".equals(action)) {
            double lat = intent.getDoubleExtra("LAT", 18.45290);
            double lng = intent.getDoubleExtra("LNG", 73.85530);
            double speed = intent.getDoubleExtra("SPEED", 0.0);
            double heading = intent.getDoubleExtra("HEADING", 0.0);
            double gForce = intent.getDoubleExtra("G_FORCE", 1.02);
            boolean isSim = intent.getBooleanExtra("IS_SIMULATION", false);
            float accuracy = intent.getFloatExtra("ACCURACY", 5.0f);
            String provider = intent.getStringExtra("PROVIDER");
            activity.updateLocationUi(lat, lng, speed, heading, gForce, isSim, accuracy, provider);
        } else if ("HELMET_BLE_STATUS".equals(action)) {
            String status = intent.getStringExtra("STATUS");
            activity.updateBleUi(status);
        } else if ("HELMET_TELEMETRY_UPDATE".equals(action)) {
            String rawJson = intent.getStringExtra("DATA");
            activity.updateTelemetryUi(rawJson);
        } else if ("HELMET_SOS_TRIGGERED".equals(action)) {
            String reason = intent.getStringExtra("REASON");
            double lat = intent.getDoubleExtra("LAT", 18.45290);
            double lng = intent.getDoubleExtra("LNG", 73.85530);
            int count = intent.getIntExtra("CONTACTS_COUNT", 1);
            activity.showSosAlertUi(reason, lat, lng, count);
        } else if ("HELMET_CALL_ESCALATION".equals(action)) {
            int idx = intent.getIntExtra("INDEX", 1);
            int total = intent.getIntExtra("TOTAL", 1);
            String name = intent.getStringExtra("CONTACT_NAME");
            String phone = intent.getStringExtra("CONTACT_PHONE");
            activity.onCallEscalationUpdate(idx, total, name, phone);
        }
    }
}
