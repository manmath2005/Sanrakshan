package com.sankalp.smarthelmet;

import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class TelemetryHttpSender implements Runnable {

    private static final String TAG = "TelemetryHttpSender";
    private String serverUrl;
    private String jsonPayload;

    public TelemetryHttpSender(String serverUrl, String jsonPayload) {
        this.serverUrl = serverUrl;
        this.jsonPayload = jsonPayload;
    }

    @Override
    public void run() {
        if (serverUrl == null || serverUrl.trim().isEmpty() || jsonPayload == null) {
            return;
        }

        HttpURLConnection conn = null;
        try {
            String targetUrl = serverUrl.trim();
            if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
                targetUrl = "http://" + targetUrl;
            }
            if (!targetUrl.endsWith("/api/telemetry") && !targetUrl.contains("/api/")) {
                if (targetUrl.endsWith("/")) targetUrl = targetUrl + "api/telemetry";
                else targetUrl = targetUrl + "/api/telemetry";
            }

            URL url = new URL(targetUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setDoOutput(true);

            byte[] outputBytes = jsonPayload.getBytes("UTF-8");
            OutputStream os = conn.getOutputStream();
            os.write(outputBytes);
            os.flush();
            os.close();

            int code = conn.getResponseCode();
            Log.d(TAG, "Telemetry sync HTTP Code: " + code + " to " + targetUrl);
        } catch (Exception e) {
            Log.w(TAG, "Telemetry send exception: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
