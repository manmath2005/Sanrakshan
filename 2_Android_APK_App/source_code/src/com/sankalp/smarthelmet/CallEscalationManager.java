package com.sankalp.smarthelmet;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;
import java.util.ArrayList;
import java.util.List;

public class CallEscalationManager extends PhoneStateListener implements Runnable {

    private static final String TAG = "CallEscalationManager";
    private static final long CALL_TIMEOUT_MS = 14000L; // 14 seconds ringing timeout if phone unanswered

    private static volatile boolean isEscalatingActive = false;
    private static CallEscalationManager activeInstance;

    private Context context;
    private List<ContactItem> contacts;
    private int currentContactIndex = 0;
    private Handler escalationHandler;

    private TelephonyManager telephonyManager;
    private boolean isCallDialed = false;
    private boolean hasBeenOffhook = false;
    private long callStartTime = 0L;

    public static boolean isCurrentlyEscalating() {
        return isEscalatingActive;
    }

    public static void notifyCallCutFromUi() {
        if (activeInstance != null) {
            activeInstance.notifyCallEndedFast();
        }
    }

    public CallEscalationManager(Context context) {
        this.context = context;
        this.escalationHandler = new Handler(Looper.getMainLooper());
        this.telephonyManager = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
    }

    public void startEscalation() {
        activeInstance = this;
        List<ContactItem> rawList = ContactStorage.loadContacts(context);
        if (rawList == null || rawList.isEmpty()) {
            Log.w(TAG, "No emergency contacts available to call.");
            return;
        }

        // Re-order so primary contact is dialed FIRST (index 0), followed by secondary contacts in order
        List<ContactItem> sorted = new ArrayList<>();
        for (ContactItem c : rawList) {
            if (c.isPrimary) sorted.add(0, c);
            else sorted.add(c);
        }
        contacts = sorted;

        currentContactIndex = 0;
        isEscalatingActive = true;
        initPhoneStateListener();
        dialCurrentContact();
    }

    private void initPhoneStateListener() {
        if (telephonyManager == null) return;
        try {
            if (context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                telephonyManager.listen(this, PhoneStateListener.LISTEN_CALL_STATE);
                Log.i(TAG, "✅ PhoneStateListener registered for real-time call tracking.");
            } else {
                Log.w(TAG, "⚠️ READ_PHONE_STATE permission not granted. Relying on ringing timeout & UI resume signals.");
            }
        } catch (Throwable e) {
            Log.e(TAG, "Error initializing call listener: " + e.getMessage());
        }
    }

    @Override
    public void onCallStateChanged(int state, String phoneNumber) {
        if (!isEscalatingActive) return;

        if (state == TelephonyManager.CALL_STATE_OFFHOOK) {
            hasBeenOffhook = true;
            Log.i(TAG, "📞 [Call Active] Call in progress / connected (OFFHOOK)");
        } else if (state == TelephonyManager.CALL_STATE_IDLE) {
            Log.i(TAG, "📴 [Call State IDLE] isCallDialed=" + isCallDialed + ", hasBeenOffhook=" + hasBeenOffhook);
            if (isCallDialed) {
                long elapsed = System.currentTimeMillis() - callStartTime;
                // Ignore initial pre-dial bounce (< 600ms). Any return to IDLE after 600ms means call was cut, rejected, or ended.
                if (elapsed >= 600L) {
                    Log.w(TAG, "🚨 Call cut / ended / rejected after " + elapsed + "ms! Auto-escalating to next contact.");
                    handleCallCutOrEnded();
                }
            }
        }
    }

    public void notifyCallEndedFast() {
        if (isEscalatingActive && isCallDialed) {
            long elapsed = System.currentTimeMillis() - callStartTime;
            if (elapsed >= 250L) {
                Log.w(TAG, "⚡ Fast call-cut signal received from UI! Handling immediate disconnect.");
                handleCallCutOrEnded();
            }
        }
    }

    private void handleCallCutOrEnded() {
        if (!isEscalatingActive) return;

        Log.w(TAG, "🚨 Contact did not receive or cut/hung up call! Auto-escalating immediately to next contact.");
        isCallDialed = false;
        hasBeenOffhook = false;
        escalationHandler.removeCallbacks(this);

        // 1200ms modem reset delay allows Android RIL & telecom stack to cleanly release audio and radio channels
        escalationHandler.postDelayed(this::advanceToNextContact, 1200L);
    }

    private void dialCurrentContact() {
        if (!isEscalatingActive || contacts == null || currentContactIndex >= contacts.size()) {
            stopEscalation();
            return;
        }

        ContactItem target = contacts.get(currentContactIndex);
        String safePhone = SecuritySanitizer.sanitizePhone(target.phone);

        if (!safePhone.isEmpty()) {
            try {
                Log.e(TAG, "🚨 [Call Escalation] Dialing Contact " + (currentContactIndex + 1) + "/" + contacts.size() + ": " + target.name + " (" + safePhone + ")");

                isCallDialed = true;
                hasBeenOffhook = false;
                callStartTime = System.currentTimeMillis();

                // If MainActivity is active, trigger dial through Activity context for foreground priority
                MainActivity main = MainActivity.getInstance();
                if (main != null && !main.isFinishing()) {
                    main.dialEmergencyCall(safePhone);
                } else {
                    Intent callIntent = new Intent(Intent.ACTION_CALL);
                    callIntent.setData(Uri.parse("tel:" + safePhone));
                    callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(callIntent);
                }

                // Broadcast escalation status to UI and Web Dashboard
                Intent statusIntent = new Intent("HELMET_CALL_ESCALATION");
                statusIntent.setPackage(context.getPackageName());
                statusIntent.putExtra("INDEX", currentContactIndex + 1);
                statusIntent.putExtra("TOTAL", contacts.size());
                statusIntent.putExtra("CONTACT_NAME", target.name);
                statusIntent.putExtra("CONTACT_PHONE", safePhone);
                context.sendBroadcast(statusIntent);

                // Unanswered timeout fallback: if not answered or cut within 14 seconds, auto-dial next
                escalationHandler.removeCallbacks(this);
                escalationHandler.postDelayed(this, CALL_TIMEOUT_MS);
            } catch (Exception e) {
                Log.e(TAG, "Call failed for " + safePhone + ": " + e.getMessage());
                advanceToNextContact();
            }
        } else {
            advanceToNextContact();
        }
    }

    @Override
    public void run() {
        if (isEscalatingActive) {
            Log.w(TAG, "⏰ Ringing timeout reached (call unanswered after 14s). Escalating to next contact...");
            advanceToNextContact();
        }
    }

    public void advanceToNextContact() {
        escalationHandler.removeCallbacks(this);
        isCallDialed = false;
        hasBeenOffhook = false;
        currentContactIndex++;
        if (contacts != null && currentContactIndex < contacts.size()) {
            dialCurrentContact();
        } else {
            Log.i(TAG, "All emergency contacts have been escalated.");
            stopEscalation();
        }
    }

    public void stopEscalation() {
        isEscalatingActive = false;
        if (activeInstance == this) activeInstance = null;
        isCallDialed = false;
        hasBeenOffhook = false;
        if (escalationHandler != null) {
            escalationHandler.removeCallbacks(this);
        }
        if (telephonyManager != null) {
            try {
                telephonyManager.listen(this, PhoneStateListener.LISTEN_NONE);
            } catch (Exception ignored) {}
        }
    }
}
