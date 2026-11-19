package com.sankalp.smarthelmet;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity implements View.OnClickListener {

    private static final String TAG = "GuardianMainActivity";
    private static MainActivity instance;

    public static MainActivity getInstance() {
        return instance;
    }

    private SharedPreferences prefs;

    // Login Gate Views
    private LinearLayout layoutLoginSection;
    private LinearLayout layoutMainDashboard;
    private EditText etLoginBikeNumber;
    private EditText etLoginPassword;
    private Button btnLoginSubmit;
    private Button btnDemoRider1;
    private Button btnDemoRider2;
    private Button btnLogout;

    // Active Profile Header
    private TextView tvActiveRiderName;
    private TextView tvActiveRiderBlood;

    // Call Escalation Status Card
    private LinearLayout layoutEscalationCard;
    private TextView tvEscalationStatus;

    // Contacts
    private LinearLayout layoutContactsContainer;
    private EditText etNewContactName;
    private EditText etNewContactPhone;
    private EditText etNewContactRelation;
    private Button btnAddContact;

    // Sensitivity & Server
    private TextView tvSensitivityLabel;
    private Button btnCycleSensitivity;
    // Server URL is now hardcoded as SERVER_URL constant — no manual input needed

    // Simulation
    private Button btnToggleSimulation;
    private Button btnSimulateCrash;

    // Telemetry & SOS
    private TextView tvGpsStatus;
    private TextView tvTelemetry;
    private TextView tvSyncStatus;
    private TextView tvSosHistory;

    // Actions
    private Button btnToggleService;
    private Button btnTestSos;
    private Button btnBatteryOpt;

    private MainTelemetryReceiver telemetryReceiver;
    private boolean isServiceRunning = false;
    private boolean isSimulationRunning = false;
    private boolean isAuthenticated = false;

    private float[] sensitivityLevels = {2.5f, 3.0f, 3.5f, 4.0f, 5.0f, 6.0f};
    private int sensitivityIndex = 3; // default 4.0G
    private boolean isDemoDrunk = false;

    // Hardcoded Vercel server URL — APK always connects to this website
    private static final String SERVER_URL = "https://sanrakshan-eight.vercel.app";

    private final String[] PERMISSIONS_BASE = {
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CALL_PHONE",
        "android.permission.READ_PHONE_STATE",
        "android.permission.SEND_SMS"
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        setContentView(R.layout.activity_main);
        setTitle("Guardian");

        prefs = getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE);

        // Login Views
        layoutLoginSection = findViewById(R.id.layoutLoginSection);
        layoutMainDashboard = findViewById(R.id.layoutMainDashboard);
        etLoginBikeNumber = findViewById(R.id.etLoginBikeNumber);
        etLoginPassword = findViewById(R.id.etLoginPassword);
        btnLoginSubmit = findViewById(R.id.btnLoginSubmit);
        btnDemoRider1 = findViewById(R.id.btnDemoRider1);
        btnDemoRider2 = findViewById(R.id.btnDemoRider2);
        btnLogout = findViewById(R.id.btnLogout);

        // Active Profile
        tvActiveRiderName = findViewById(R.id.tvActiveRiderName);
        tvActiveRiderBlood = findViewById(R.id.tvActiveRiderBlood);

        // Escalation Card
        layoutEscalationCard = findViewById(R.id.layoutEscalationCard);
        tvEscalationStatus = findViewById(R.id.tvEscalationStatus);

        // Contacts
        layoutContactsContainer = findViewById(R.id.layoutContactsContainer);
        etNewContactName = findViewById(R.id.etNewContactName);
        etNewContactPhone = findViewById(R.id.etNewContactPhone);
        etNewContactRelation = findViewById(R.id.etNewContactRelation);
        btnAddContact = findViewById(R.id.btnAddContact);

        // Sensitivity & Server
        tvSensitivityLabel = findViewById(R.id.tvSensitivityLabel);
        btnCycleSensitivity = findViewById(R.id.btnCycleSensitivity);
        // Hide manual URL input field — server is permanently linked to website
        View serverUrlField = findViewById(R.id.etServerUrl);
        if (serverUrlField != null) {
            serverUrlField.setVisibility(View.GONE);
        }

        // Simulation
        btnToggleSimulation = findViewById(R.id.btnToggleSimulation);
        btnSimulateCrash = findViewById(R.id.btnSimulateCrash);

        // Telemetry
        tvGpsStatus = findViewById(R.id.tvGpsStatus);
        tvTelemetry = findViewById(R.id.tvTelemetry);
        tvSyncStatus = findViewById(R.id.tvSyncStatus);
        tvSosHistory = findViewById(R.id.tvSosHistory);

        // Actions
        btnToggleService = findViewById(R.id.btnToggleService);
        btnTestSos = findViewById(R.id.btnTestSos);
        btnBatteryOpt = findViewById(R.id.btnBatteryOpt);

        // Server URL is hardcoded — no SharedPreferences loading needed

        // Bind Listeners
        btnLoginSubmit.setOnClickListener(this);
        btnLogout.setOnClickListener(this);
        btnAddContact.setOnClickListener(this);
        btnToggleService.setOnClickListener(this);
        btnTestSos.setOnClickListener(this);
        btnBatteryOpt.setOnClickListener(this);

        // Totally remove all Demo Simulation cards and buttons
        if (btnToggleSimulation != null && btnToggleSimulation.getParent() != null && btnToggleSimulation.getParent().getParent() instanceof View) {
            ((View) btnToggleSimulation.getParent().getParent()).setVisibility(View.GONE);
        }
        if (btnDemoRider1 != null) btnDemoRider1.setVisibility(View.GONE);
        if (btnDemoRider2 != null) btnDemoRider2.setVisibility(View.GONE);
        if (btnCycleSensitivity != null && btnCycleSensitivity.getParent() instanceof View) {
            ((View) btnCycleSensitivity.getParent()).setVisibility(View.GONE);
        }

        // Check if session exists
        boolean savedAuth = prefs.getBoolean("IS_LOGGED_IN", false);
        if (savedAuth) {
            unlockDashboard(prefs.getString("SAVED_VEHICLE", "MH-12-AB-1234"), prefs.getString("SAVED_NAME", "Manmath"));
        } else {
            lockDashboard();
        }

        // Register Receiver
        telemetryReceiver = new MainTelemetryReceiver(this);
        IntentFilter filter = new IntentFilter();
        filter.addAction("HELMET_LOCATION_UPDATE");
        filter.addAction("HELMET_BLE_STATUS");
        filter.addAction("HELMET_TELEMETRY_UPDATE");
        filter.addAction("HELMET_SOS_TRIGGERED");
        filter.addAction("HELMET_CALL_ESCALATION");

        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(telemetryReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(telemetryReceiver, filter);
        }

        applyMorphismDesign();

        boolean hasProfile = RiderProfile.isProfileCreated(this);
        if (!hasProfile) {
            new Handler(Looper.getMainLooper()).postDelayed(this::showCreateProfileDialog, 400);
        } else if (!prefs.getBoolean("HAS_SEEN_TUTORIAL_V3", false)) {
            new Handler(Looper.getMainLooper()).postDelayed(this::showOnboardingTutorialDialog, 400);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            CallEscalationManager.notifyCallCutFromUi();

            if (isServiceRunning || CallEscalationManager.isCurrentlyEscalating()) {
                Intent cutIntent = new Intent(this, HelmetTrackingService.class);
                cutIntent.setAction("NOTIFY_CALL_CUT_FAST");
                cutIntent.setPackage(getPackageName());
                startService(cutIntent);

                Intent refreshGps = new Intent(this, HelmetTrackingService.class);
                refreshGps.setAction("REFRESH_REAL_GPS");
                refreshGps.setPackage(getPackageName());
                startService(refreshGps);
            }

            checkLocationSettings();
        } catch (Exception ignored) {}
    }

    private void checkLocationSettings() {
        try {
            android.location.LocationManager lm = (android.location.LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm != null && !lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)) {
                Toast.makeText(this, "⚠️ Phone GPS is OFF! Please turn ON Location in Settings for real-time tracking.", Toast.LENGTH_LONG).show();
            }
        } catch (Exception ignored) {}
    }

    private void applyMorphismDesign() {
        try {
            if (layoutLoginSection != null && layoutLoginSection.getParent() instanceof ViewGroup) {
                ViewGroup parent = (ViewGroup) layoutLoginSection.getParent();
                if (parent.getChildCount() > 0 && parent.getChildAt(0) instanceof ViewGroup) {
                    ViewGroup headerRow = (ViewGroup) parent.getChildAt(0);

                    // Insert Logo ImageView if not already added
                    if (headerRow.getChildCount() > 0 && !(headerRow.getChildAt(0) instanceof ImageView)) {
                        ImageView logoView = new ImageView(this);
                        int logoResId = getResources().getIdentifier("guardian_logo", "drawable", getPackageName());
                        if (logoResId == 0) {
                            logoResId = getResources().getIdentifier("ic_launcher", "drawable", getPackageName());
                        }
                        if (logoResId != 0) {
                            logoView.setImageResource(logoResId);
                            int sizePx = (int) (52 * getResources().getDisplayMetrics().density);
                            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(sizePx, sizePx);
                            lp.setMargins(0, 0, (int)(12 * getResources().getDisplayMetrics().density), 0);
                            logoView.setLayoutParams(lp);
                            headerRow.addView(logoView, 0);
                        }
                    }

                    // Update Title & Motto
                    for (int i = 0; i < headerRow.getChildCount(); i++) {
                        View child = headerRow.getChildAt(i);
                        if (child instanceof ViewGroup) {
                            ViewGroup titleCol = (ViewGroup) child;
                            for (int j = 0; j < titleCol.getChildCount(); j++) {
                                View tv = titleCol.getChildAt(j);
                                if (tv instanceof TextView) {
                                    TextView textView = (TextView) tv;
                                    String text = textView.getText().toString();
                                    if (text.contains("SMART HELMET")) {
                                        textView.setText("🛡️ GUARDIAN");
                                        textView.setTextColor(0xFF00E5FF);
                                    } else if (text.contains("Gateway") || text.contains("Defense")) {
                                        textView.setText("\"Your Silent Co-Rider for Life & Safety.\"");
                                        textView.setTextColor(0xFF38BDF8);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Glassmorphism card drawable (frosted dark surface + subtle cyan/slate border + rounded corners)
            GradientDrawable glassCard = new GradientDrawable();
            glassCard.setColor(0xEE0B1120);
            glassCard.setCornerRadius(28f);
            glassCard.setStroke(2, 0x4038BDF8);

            GradientDrawable dashboardGlass = new GradientDrawable();
            dashboardGlass.setColor(0xEE0B1120);
            dashboardGlass.setCornerRadius(28f);
            dashboardGlass.setStroke(2, 0x4010B981);

            if (layoutLoginSection != null) {
                layoutLoginSection.setBackground(glassCard);
                if (layoutLoginSection.findViewWithTag("GUIDE_BTN_LOGIN") == null) {
                    Button btnLoginHelp = new Button(this);
                    btnLoginHelp.setTag("GUIDE_BTN_LOGIN");
                    btnLoginHelp.setText("📖 SETUP GUIDE & BACKGROUND INSTRUCTIONS");
                    btnLoginHelp.setTextSize(11f);
                    styleMorphismButton(btnLoginHelp, 0xFF1E293B, 0xFF38BDF8);
                    LinearLayout.LayoutParams lhlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    lhlp.setMargins(0, (int)(12 * getResources().getDisplayMetrics().density), 0, 0);
                    btnLoginHelp.setLayoutParams(lhlp);
                    btnLoginHelp.setOnClickListener(v -> showOnboardingTutorialDialog());
                    layoutLoginSection.addView(btnLoginHelp);
                }
            }
            if (layoutMainDashboard != null) {
                layoutMainDashboard.setBackground(dashboardGlass);

                if (layoutMainDashboard.findViewWithTag("MISSION_CARD") == null) {
                    // Add Mission Card with Motto
                    LinearLayout missionCard = new LinearLayout(this);
                    missionCard.setTag("MISSION_CARD");
                    missionCard.setOrientation(LinearLayout.VERTICAL);
                    GradientDrawable mcBg = new GradientDrawable();
                    mcBg.setColor(0xCC0F172A);
                    mcBg.setCornerRadius(20f);
                    mcBg.setStroke(2, 0x3338BDF8);
                    missionCard.setBackground(mcBg);
                    int pX = (int) (14 * getResources().getDisplayMetrics().density);
                    int pY = (int) (10 * getResources().getDisplayMetrics().density);
                    missionCard.setPadding(pX, pY, pX, pY);
                    LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    mlp.setMargins(0, 0, 0, (int)(12 * getResources().getDisplayMetrics().density));
                    missionCard.setLayoutParams(mlp);

                    TextView tvMottoTitle = new TextView(this);
                    tvMottoTitle.setText("💡 GUARDIAN MISSION");
                    tvMottoTitle.setTextColor(0xFF00E5FF);
                    tvMottoTitle.setTextSize(13f);
                    tvMottoTitle.setTypeface(null, android.graphics.Typeface.BOLD);
                    missionCard.addView(tvMottoTitle);

                    TextView tvMottoBody = new TextView(this);
                    tvMottoBody.setText("\"Your Silent Co-Rider for Life & Safety.\"\nIntelligent alcohol interlock, IR helmet check, continuous GPS & autonomous emergency rescue.");
                    tvMottoBody.setTextColor(0xFF94A3B8);
                    tvMottoBody.setTextSize(11f);
                    tvMottoBody.setPadding(0, 4, 0, 0);
                    missionCard.addView(tvMottoBody);

                    Button btnHelpGuide = new Button(this);
                    btnHelpGuide.setText("📖 SETUP GUIDE & BACKGROUND INSTRUCTIONS");
                    btnHelpGuide.setTextSize(11f);
                    styleMorphismButton(btnHelpGuide, 0xFF1E293B, 0xFF38BDF8);
                    LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    hlp.setMargins(0, (int)(8 * getResources().getDisplayMetrics().density), 0, 0);
                    btnHelpGuide.setLayoutParams(hlp);
                    btnHelpGuide.setOnClickListener(v -> showOnboardingTutorialDialog());
                    missionCard.addView(btnHelpGuide);

                    layoutMainDashboard.addView(missionCard, 0);
                }
            }

            // Style buttons with sleek modern morphism shapes
            styleMorphismButton(btnLoginSubmit, 0xFF00E5FF, 0xFF050811);
            styleMorphismButton(btnDemoRider1, 0xFF1E293B, 0xFF38BDF8);
            styleMorphismButton(btnDemoRider2, 0xFF1E293B, 0xFF38BDF8);
            styleMorphismButton(btnToggleService, 0xFF00E5FF, 0xFF050811);
            styleMorphismButton(btnTestSos, 0xFFEF4444, 0xFFFFFFFF);
            styleMorphismButton(btnCycleSensitivity, 0xFF10B981, 0xFFFFFFFF);
            styleMorphismButton(btnToggleSimulation, 0xFF2563EB, 0xFFFFFFFF);
            if (btnToggleSimulation != null) {
                btnToggleSimulation.setText("🎮 OPTIONAL: DEMO ROAD SIMULATION");
            }
            styleMorphismButton(btnSimulateCrash, 0xFFDC2626, 0xFFFFFFFF);
            styleMorphismButton(btnAddContact, 0xFF00E5FF, 0xFF050811);
            styleMorphismButton(btnLogout, 0xFF334155, 0xFFEF4444);

        } catch (Exception e) {
            Log.e(TAG, "Morphism UI Error: " + e.getMessage());
        }
    }

    private void styleMorphismButton(Button btn, int bgColor, int textColor) {
        if (btn == null) return;
        try {
            GradientDrawable gd = new GradientDrawable();
            gd.setColor(bgColor);
            gd.setCornerRadius(20f);
            btn.setBackground(gd);
            btn.setTextColor(textColor);
        } catch (Exception ignored) {}
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.btnLoginSubmit) {
            handleLoginSubmit();
        } else if (id == R.id.btnDemoRider1) {
            etLoginBikeNumber.setText("MH-12-AB-1234");
            etLoginPassword.setText("Manmath");
            unlockDashboard("MH-12-AB-1234", "Manmath");
        } else if (id == R.id.btnDemoRider2) {
            etLoginBikeNumber.setText("MH-14-CD-5678");
            etLoginPassword.setText("Aarav");
            unlockDashboard("MH-14-CD-5678", "Aarav");
        } else if (id == R.id.btnLogout) {
            lockDashboard();
        } else if (id == R.id.btnAddContact) {
            addNewContact();
        } else if (id == R.id.btnCycleSensitivity) {
            isDemoDrunk = !isDemoDrunk;
            updateSensitivityUi();
            int adc = isDemoDrunk ? 1250 : 380;

            ensureServiceStarted();
            Intent intent = new Intent(this, HelmetTrackingService.class);
            intent.putExtra("SET_ALCOHOL_ADC", adc);
            startService(intent);

            Toast.makeText(this, isDemoDrunk 
                ? "🛑 High Breath Alcohol (>800 ADC)! Ignition is LOCKED!" 
                : "✅ Breath Alcohol Normal (<800 ADC). Ignition is UNLOCKED!", 
                Toast.LENGTH_SHORT).show();
        } else if (id == R.id.btnToggleSimulation) {
            toggleDemoSimulation();
        } else if (id == R.id.btnSimulateCrash) {
            triggerSimulatedCrash();
        } else if (id == R.id.btnToggleService) {
            checkPermissionsAndToggle();
        } else if (id == R.id.btnTestSos) {
            triggerManualSos();
        } else if (id == R.id.btnBatteryOpt) {
            requestBatteryOptimizationExemption();
        }
    }

    private void handleLoginSubmit() {
        String bikeNum = SecuritySanitizer.sanitizeText(etLoginBikeNumber.getText().toString(), "").toUpperCase();
        String passName = SecuritySanitizer.sanitizeText(etLoginPassword.getText().toString(), "");

        if (bikeNum.isEmpty() || passName.isEmpty()) {
            Toast.makeText(this, "Please enter your Bike Number and Rider Name (Password)", Toast.LENGTH_SHORT).show();
            return;
        }

        unlockDashboard(bikeNum, passName);
    }

    private void unlockDashboard(String bikeNum, String riderName) {
        isAuthenticated = true;
        prefs.edit()
            .putBoolean("IS_LOGGED_IN", true)
            .putString("SAVED_VEHICLE", bikeNum)
            .putString("SAVED_NAME", riderName)
            .apply();

        RiderProfile p = RiderProfile.load(this);
        if (riderName != null && !riderName.isEmpty()) p.riderName = riderName;
        if (bikeNum != null && !bikeNum.isEmpty()) p.vehicleNumber = bikeNum;
        p.save(this);

        tvActiveRiderName.setText(p.riderName + " (" + p.vehicleNumber + ")");
        tvActiveRiderBlood.setText("Age: " + p.age + " | Blood: " + p.bloodGroup + " | Bike: " + p.vehicleNumber);

        tvActiveRiderName.setOnClickListener(v -> showCreateProfileDialog());
        tvActiveRiderBlood.setOnClickListener(v -> showCreateProfileDialog());

        layoutLoginSection.setVisibility(View.GONE);
        layoutMainDashboard.setVisibility(View.VISIBLE);
        btnLogout.setVisibility(View.VISIBLE);

        renderContactsList();
        renderSosHistory();
        ensureServiceStarted();

        Toast.makeText(this, "Welcome, " + p.riderName + "! Smart Helmet Activated.", Toast.LENGTH_SHORT).show();
    }

    private void lockDashboard() {
        isAuthenticated = false;
        prefs.edit().putBoolean("IS_LOGGED_IN", false).apply();
        layoutLoginSection.setVisibility(View.VISIBLE);
        layoutMainDashboard.setVisibility(View.GONE);
        btnLogout.setVisibility(View.GONE);
        etLoginPassword.setText("");
        Toast.makeText(this, "Session Locked.", Toast.LENGTH_SHORT).show();
    }

    private void addNewContact() {
        String name = SecuritySanitizer.sanitizeText(etNewContactName.getText().toString(), "");
        String phone = SecuritySanitizer.sanitizePhone(etNewContactPhone.getText().toString());
        String rel = SecuritySanitizer.sanitizeText(etNewContactRelation.getText().toString(), "Family");

        if (name.isEmpty() || phone.isEmpty()) {
            Toast.makeText(this, "Please enter valid Contact Name and Phone Number", Toast.LENGTH_SHORT).show();
            return;
        }

        List<ContactItem> list = ContactStorage.loadContacts(this);
        boolean isFirst = list.isEmpty();
        ContactStorage.addContact(this, name, phone, rel, isFirst);

        etNewContactName.setText("");
        etNewContactPhone.setText("");
        etNewContactRelation.setText("");
        renderContactsList();
        Toast.makeText(this, "Emergency Contact Added: " + name, Toast.LENGTH_SHORT).show();
    }

    private void renderContactsList() {
        layoutContactsContainer.removeAllViews();
        List<ContactItem> contacts = ContactStorage.loadContacts(this);

        for (int i = 0; i < contacts.size(); i++) {
            ContactItem item = contacts.get(i);
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setBackgroundColor(item.isPrimary ? Color.parseColor("#1E293B") : Color.parseColor("#0B132B"));
            card.setPadding(12, 10, 12, 10);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.setMargins(0, 6, 0, 6);
            card.setLayoutParams(params);

            LinearLayout row1 = new LinearLayout(this);
            row1.setOrientation(LinearLayout.HORIZONTAL);

            TextView tvName = new TextView(this);
            tvName.setText((item.isPrimary ? "⭐ [PRIMARY] " : "👤 ") + item.name + " (" + item.relation + ")");
            tvName.setTextColor(item.isPrimary ? Color.parseColor("#00E5FF") : Color.parseColor("#F8FAFC"));
            tvName.setTextSize(13);
            tvName.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));
            row1.addView(tvName);

            TextView tvPhone = new TextView(this);
            tvPhone.setText(item.phone);
            tvPhone.setTextColor(Color.parseColor("#94A3B8"));
            tvPhone.setTextSize(12);
            row1.addView(tvPhone);
            card.addView(row1);

            LinearLayout row2 = new LinearLayout(this);
            row2.setOrientation(LinearLayout.HORIZONTAL);
            row2.setPadding(0, 6, 0, 0);

            Button btnCall = new Button(this);
            btnCall.setText("📞 CALL");
            btnCall.setTextSize(10);
            btnCall.setBackgroundColor(Color.parseColor("#059669"));
            btnCall.setTextColor(Color.WHITE);
            btnCall.setPadding(8, 2, 8, 2);
            final String ph = item.phone;
            btnCall.setOnClickListener(new ContactActionClickListener(this, ph, "CALL", item.id));
            row2.addView(btnCall);

            if (!item.isPrimary) {
                Button btnMakePrimary = new Button(this);
                btnMakePrimary.setText("MAKE PRIMARY");
                btnMakePrimary.setTextSize(10);
                btnMakePrimary.setBackgroundColor(Color.parseColor("#334155"));
                btnMakePrimary.setTextColor(Color.parseColor("#38BDF8"));
                LinearLayout.LayoutParams pPrim = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
                pPrim.setMargins(8, 0, 0, 0);
                btnMakePrimary.setLayoutParams(pPrim);
                btnMakePrimary.setOnClickListener(new ContactActionClickListener(this, ph, "PRIMARY", item.id));
                row2.addView(btnMakePrimary);
            }

            Button btnDel = new Button(this);
            btnDel.setText("🗑️ DEL");
            btnDel.setTextSize(10);
            btnDel.setBackgroundColor(Color.parseColor("#991B1B"));
            btnDel.setTextColor(Color.WHITE);
            LinearLayout.LayoutParams pDel = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            pDel.setMargins(8, 0, 0, 0);
            btnDel.setLayoutParams(pDel);
            btnDel.setOnClickListener(new ContactActionClickListener(this, ph, "DELETE", item.id));
            row2.addView(btnDel);

            card.addView(row2);
            layoutContactsContainer.addView(card);
        }
    }

    public void handleContactAction(String action, String contactId, String phone) {
        String safePhone = SecuritySanitizer.sanitizePhone(phone);
        if ("CALL".equals(action)) {
            if (safePhone.isEmpty()) {
                Toast.makeText(this, "Invalid phone number", Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                Intent callIntent = new Intent(Intent.ACTION_CALL);
                callIntent.setData(Uri.parse("tel:" + safePhone));
                startActivity(callIntent);
            } catch (Exception e) {
                Toast.makeText(this, "Call error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        } else if ("PRIMARY".equals(action)) {
            ContactStorage.setPrimary(this, contactId);
            renderContactsList();
            Toast.makeText(this, "Primary Contact Updated ⭐", Toast.LENGTH_SHORT).show();
        } else if ("DELETE".equals(action)) {
            ContactStorage.deleteContact(this, contactId);
            renderContactsList();
            Toast.makeText(this, "Contact Removed", Toast.LENGTH_SHORT).show();
        }
    }

    public void onCallEscalationUpdate(int index, int total, String name, String phone) {
        if (layoutEscalationCard != null) {
            layoutEscalationCard.setVisibility(View.VISIBLE);
            tvEscalationStatus.setText("🚨 CALL ESCALATION [" + index + "/" + total + "]: Dialing " + name + " (" + phone + ")...");
        }
    }

    private void renderSosHistory() {
        String json = prefs.getString("SOS_HISTORY_LOG", "[]");
        try {
            JSONArray arr = new JSONArray(json);
            if (arr.length() == 0) {
                tvSosHistory.setText("No emergency dispatches recorded. System is on standby.");
                return;
            }
            StringBuilder sb = new StringBuilder();
            SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.getDefault());
            for (int i = 0; i < Math.min(arr.length(), 5); i++) {
                JSONObject obj = arr.getJSONObject(i);
                long ts = obj.optLong("timestamp", System.currentTimeMillis());
                double lat = obj.optDouble("lat", 0.0);
                double lng = obj.optDouble("lng", 0.0);
                double g = obj.optDouble("gForce", 4.0);
                int count = obj.optInt("contactsCount", 1);
                String call = obj.optString("callTarget", "");

                sb.append("🚨 [").append(sdf.format(new Date(ts))).append("] Impact: ")
                  .append(String.format(Locale.US, "%.1fG", g))
                  .append(" | Coordinates: ").append(String.format(Locale.US, "%.4f, %.4f", lat, lng))
                  .append("\n   SMS Dispatched: ").append(count).append(" Contacts | Auto-Called: ").append(call)
                  .append("\n\n");
            }
            tvSosHistory.setText(sb.toString().trim());
        } catch (Exception ignored) {
            tvSosHistory.setText("Standby for emergency events.");
        }
    }

    private void updateSensitivityUi() {
        if (tvSensitivityLabel != null) {
            tvSensitivityLabel.setText("Alcohol Interlock Simulation:");
        }
        if (btnCycleSensitivity != null) {
            if (isDemoDrunk) {
                btnCycleSensitivity.setText("🍺 DRUNK (1250 ADC) | IGNITION: LOCKED 🛑");
                btnCycleSensitivity.setBackgroundColor(0xFFDC2626);
            } else {
                btnCycleSensitivity.setText("🍺 SOBER (380 ADC) | IGNITION: UNLOCKED ✅");
                btnCycleSensitivity.setBackgroundColor(0xFF059669);
            }
        }
    }

    private void toggleDemoSimulation() {
        ensureServiceStarted();
        isSimulationRunning = !isSimulationRunning;

        Intent intent = new Intent(this, HelmetTrackingService.class);
        intent.setPackage(getPackageName());
        intent.putExtra("TOGGLE_SIMULATION", true);
        intent.putExtra("SIM_STATE", isSimulationRunning);
        intent.putExtra("SERVER_URL", SERVER_URL);
        intent.putExtra("SENSITIVITY_G", sensitivityLevels[sensitivityIndex]);
        startService(intent);

        if (isSimulationRunning) {
            btnToggleSimulation.setText("⏹️ STOP DEMO SIMULATION");
            btnToggleSimulation.setBackgroundColor(Color.parseColor("#EA580C"));
            Toast.makeText(this, "🎮 Demo Simulation Active! Coords streaming...", Toast.LENGTH_SHORT).show();
        } else {
            btnToggleSimulation.setText("🎮 OPTIONAL: DEMO ROAD SIMULATION");
            btnToggleSimulation.setBackgroundColor(Color.parseColor("#2563EB"));
            Toast.makeText(this, "Simulation Stopped. Reverted to Real Phone GPS!", Toast.LENGTH_SHORT).show();
            Intent refreshGps = new Intent(this, HelmetTrackingService.class);
            refreshGps.setAction("REFRESH_REAL_GPS");
            startService(refreshGps);
        }
    }

    private void triggerSimulatedCrash() {
        ensureServiceStarted();
        Toast.makeText(this, "💥 SIMULATING 5.2G ACCIDENT & AUTO-CALL ESCALATION!", Toast.LENGTH_SHORT).show();

        Intent intent = new Intent(this, HelmetTrackingService.class);
        intent.setPackage(getPackageName());
        intent.putExtra("TRIGGER_SIM_CRASH", true);
        intent.putExtra("SERVER_URL", SERVER_URL);
        intent.putExtra("SENSITIVITY_G", sensitivityLevels[sensitivityIndex]);
        startService(intent);
    }

    private void ensureServiceStarted() {
        if (!isServiceRunning) {
            Intent serviceIntent = new Intent(this, HelmetTrackingService.class);
            serviceIntent.setPackage(getPackageName());
            serviceIntent.putExtra("SERVER_URL", SERVER_URL);
            serviceIntent.putExtra("SENSITIVITY_G", sensitivityLevels[sensitivityIndex]);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            isServiceRunning = true;
            btnToggleService.setText("🛑 STOP BACKGROUND TRACKING");
            btnToggleService.setBackgroundColor(0xFFEF4444);
        }
    }

    public void updateLocationUi(double lat, double lng, double speed, double heading, double gForce, boolean isSim) {
        updateLocationUi(lat, lng, speed, heading, gForce, isSim, 4.0f, isSim ? "SIMULATION" : "HARDWARE_GPS");
    }

    public void updateLocationUi(double lat, double lng, double speed, double heading, double gForce, boolean isSim, float accuracy, String provider) {
        if (isSim) {
            tvGpsStatus.setText(String.format(Locale.US, "🎮 DEMO ROUTE: %.5f, %.5f (%.1f km/h, %.0f°)", lat, lng, speed, heading));
            tvGpsStatus.setTextColor(0xFF38BDF8);
            tvSyncStatus.setText(String.format(Locale.US, "🌐 Web Sync: [DEMO SIMULATION] -> %s", SERVER_URL));
        } else {
            tvGpsStatus.setText(String.format(Locale.US, "📍 REAL GPS [LIVE]: %.5f, %.5f (±%.1fm)\n⚡ SPEED: %.1f km/h [Fused GPS + Accel]", lat, lng, accuracy, speed));
            tvGpsStatus.setTextColor(0xFF10B981);
            tvSyncStatus.setText(String.format(Locale.US, "🌐 Web Sync: [REAL PHONE GPS] -> %s", SERVER_URL));
        }
        tvTelemetry.setText(String.format(Locale.US, "📊 Helmet: Worn ✅ | Alcohol: 0 mg/L | Impact: %.2fG", gForce));
    }

    public void updateBleUi(String status) {
        if (tvSyncStatus != null) {
            tvSyncStatus.setText("📱 BLE: " + status + " | Cloud Sync Active");
            if (status != null && status.toLowerCase().contains("connected")) {
                tvSyncStatus.setTextColor(0xFF10B981); // Emerald Green
            } else {
                tvSyncStatus.setTextColor(0xFF38BDF8); // Sky Blue
            }
        }
    }

    public void updateTelemetryUi(String rawJson) {
        if (rawJson != null) {
            try {
                JSONObject json = new JSONObject(rawJson);
                boolean helmet = json.optBoolean("helmet", true);
                int alcohol = json.optInt("alcohol", 0);
                double gForce = json.optDouble("gForce", 1.02);
                boolean crash = json.optBoolean("crash", false);

                String helmetStr = helmet ? "🪖 HELMET: WORN [OK] ✅" : "🪖 HELMET: REMOVED [X] ⚠️";
                String alcoholStr = (alcohol >= 800)
                    ? "🍺 ALCOHOL: DRUNK (" + alcohol + " ADC) 🛑"
                    : "🍺 ALCOHOL: SOBER (" + alcohol + " ADC) ✅";
                String crashStr = crash
                    ? "🚨 CRASH SOS TRIGGERED! (" + String.format(Locale.US, "%.2fG", gForce) + ")"
                    : "💥 IMPACT FORCE: " + String.format(Locale.US, "%.2fG", gForce);

                tvTelemetry.setText(helmetStr + "\n" + alcoholStr + "\n" + crashStr);
                tvTelemetry.setTextColor((alcohol >= 800 || crash) ? 0xFFEF4444 : 0xFF10B981);
            } catch (Exception ignored) {}
        }
    }

    public void showSosAlertUi(String reason, double lat, double lng, int count) {
        renderSosHistory();
        if (layoutEscalationCard != null) layoutEscalationCard.setVisibility(View.VISIBLE);
        Toast.makeText(this, "🚨 CRASH SOS TRIGGERED! SMS with GPS coordinates sent to " + count + " contacts + Escalating Calls!", Toast.LENGTH_LONG).show();
    }

    private void checkPermissionsAndToggle() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            boolean hasBase = true;
            for (String perm : PERMISSIONS_BASE) {
                if (checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) {
                    hasBase = false;
                    break;
                }
            }

            if (Build.VERSION.SDK_INT >= 31) {
                if (checkSelfPermission("android.permission.BLUETOOTH_SCAN") != PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED) {
                    hasBase = false;
                }
            }

            if (Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    hasBase = false;
                }
            }

            if (!hasBase) {
                String[] permsToReq;
                if (Build.VERSION.SDK_INT >= 33) {
                    permsToReq = new String[]{
                        "android.permission.ACCESS_FINE_LOCATION",
                        "android.permission.ACCESS_COARSE_LOCATION",
                        "android.permission.CALL_PHONE",
                        "android.permission.READ_PHONE_STATE",
                        "android.permission.SEND_SMS",
                        "android.permission.BLUETOOTH_SCAN",
                        "android.permission.BLUETOOTH_CONNECT",
                        "android.permission.POST_NOTIFICATIONS"
                    };
                } else if (Build.VERSION.SDK_INT >= 31) {
                    permsToReq = new String[]{
                        "android.permission.ACCESS_FINE_LOCATION",
                        "android.permission.ACCESS_COARSE_LOCATION",
                        "android.permission.CALL_PHONE",
                        "android.permission.READ_PHONE_STATE",
                        "android.permission.SEND_SMS",
                        "android.permission.BLUETOOTH_SCAN",
                        "android.permission.BLUETOOTH_CONNECT"
                    };
                } else {
                    permsToReq = PERMISSIONS_BASE;
                }
                requestPermissions(permsToReq, 101);
                return;
            }
        }
        toggleTrackingService();
    }

    private void toggleTrackingService() {
        Intent serviceIntent = new Intent(this, HelmetTrackingService.class);
        serviceIntent.setPackage(getPackageName());
        serviceIntent.putExtra("SERVER_URL", SERVER_URL);
        serviceIntent.putExtra("SENSITIVITY_G", sensitivityLevels[sensitivityIndex]);

        if (!isServiceRunning) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            isServiceRunning = true;
            btnToggleService.setText("🛑 STOP BACKGROUND TRACKING");
            btnToggleService.setBackgroundColor(0xFFEF4444);
            Toast.makeText(this, "Guardian Tracking Active in Background!", Toast.LENGTH_SHORT).show();
        } else {
            stopService(serviceIntent);
            isServiceRunning = false;
            isSimulationRunning = false;
            btnToggleSimulation.setText("🎮 OPTIONAL: DEMO ROAD SIMULATION");
            btnToggleSimulation.setBackgroundColor(Color.parseColor("#2563EB"));
            btnToggleService.setText("🚀 START BACKGROUND TRACKING");
            btnToggleService.setBackgroundColor(0xFF00E5FF);
            Toast.makeText(this, "Tracking Service Stopped.", Toast.LENGTH_SHORT).show();
        }
    }

    private void triggerManualSos() {
        ensureServiceStarted();
        Toast.makeText(this, "🚨 Dispatching Emergency SOS & Multi-Contact Call Escalation...", Toast.LENGTH_LONG).show();

        Intent intent = new Intent(this, HelmetTrackingService.class);
        intent.setPackage(getPackageName());
        intent.putExtra("TRIGGER_SOS", true);
        intent.putExtra("SERVER_URL", SERVER_URL);
        intent.putExtra("SENSITIVITY_G", sensitivityLevels[sensitivityIndex]);
        startService(intent);
    }

    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } else {
                    Toast.makeText(this, "Battery optimization is already unrestricted! ✅", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(this, "Open phone Settings -> Battery -> Unrestricted", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void showCreateProfileDialog() {
        if (isFinishing()) return;
        try {
            final android.app.Dialog dialog = new android.app.Dialog(this);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            dialog.setCancelable(false);
            if (dialog.getWindow() != null) {
                dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            }

            ScrollView scrollView = new ScrollView(this);
            scrollView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            GradientDrawable rootBg = new GradientDrawable();
            rootBg.setColor(0xF50B1120);
            rootBg.setCornerRadius(32f);
            rootBg.setStroke(3, 0xFF00E5FF);
            root.setBackground(rootBg);
            int p = (int) (20 * getResources().getDisplayMetrics().density);
            root.setPadding(p, p, p, p);

            // Title
            TextView tvTitle = new TextView(this);
            tvTitle.setText("🪪 CREATE RIDER SAFETY PROFILE");
            tvTitle.setTextColor(0xFF00E5FF);
            tvTitle.setTextSize(17f);
            tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
            root.addView(tvTitle);

            TextView tvSub = new TextView(this);
            tvSub.setText("Required for emergency rescue SMS, blood donor matching, & crash identification.");
            tvSub.setTextColor(0xFF94A3B8);
            tvSub.setTextSize(11.5f);
            tvSub.setPadding(0, 4, 0, (int)(14 * getResources().getDisplayMetrics().density));
            root.addView(tvSub);

            RiderProfile currentProfile = RiderProfile.load(this);

            // 1. Rider Full Name
            root.addView(createFieldLabel("👤 RIDER FULL NAME"));
            EditText etName = createMorphismInput(currentProfile.riderName.equals("Manmath") ? "" : currentProfile.riderName, "e.g. Rahul Sharma");
            root.addView(etName);

            // 2. Rider Age
            root.addView(createFieldLabel("🎂 RIDER AGE"));
            EditText etAge = createMorphismInput(currentProfile.age, "e.g. 24");
            etAge.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
            root.addView(etAge);

            // 3. Blood Group
            root.addView(createFieldLabel("🩸 BLOOD GROUP"));
            final String[] selectedBlood = { (currentProfile.bloodGroup != null && !currentProfile.bloodGroup.isEmpty()) ? currentProfile.bloodGroup : "O+" };
            String[] bloodGroups = {"O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"};
            LinearLayout bloodRow1 = new LinearLayout(this);
            bloodRow1.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout bloodRow2 = new LinearLayout(this);
            bloodRow2.setOrientation(LinearLayout.HORIZONTAL);

            final java.util.List<Button> bloodButtons = new java.util.ArrayList<>();
            for (int i = 0; i < bloodGroups.length; i++) {
                final String bgName = bloodGroups[i];
                Button b = new Button(this);
                b.setText(bgName);
                b.setTextSize(11f);
                b.setTypeface(null, android.graphics.Typeface.BOLD);
                LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(0, (int)(38 * getResources().getDisplayMetrics().density), 1f);
                blp.setMargins(4, 4, 4, 4);
                b.setLayoutParams(blp);

                boolean isSelected = bgName.equalsIgnoreCase(selectedBlood[0]);
                styleMorphismButton(b, isSelected ? 0xFF00E5FF : 0xFF334155, isSelected ? 0xFF050811 : 0xFFFFFFFF);

                b.setOnClickListener(v -> {
                    selectedBlood[0] = bgName;
                    for (Button btn : bloodButtons) {
                        boolean sel = btn.getText().toString().equals(bgName);
                        styleMorphismButton(btn, sel ? 0xFF00E5FF : 0xFF334155, sel ? 0xFF050811 : 0xFFFFFFFF);
                    }
                });

                bloodButtons.add(b);
                if (i < 4) bloodRow1.addView(b);
                else bloodRow2.addView(b);
            }
            root.addView(bloodRow1);
            root.addView(bloodRow2);

            // 4. Bike Number
            root.addView(createFieldLabel("🏍️ BIKE / VEHICLE REGISTRATION NUMBER"));
            EditText etBike = createMorphismInput(currentProfile.vehicleNumber.equals("MH-12-AB-1234") ? "" : currentProfile.vehicleNumber, "e.g. MH-12-AB-1234");
            root.addView(etBike);

            // Save Button
            Button btnSave = new Button(this);
            btnSave.setText("SAVE PROFILE & CONTINUE 🚀");
            btnSave.setTextSize(13f);
            btnSave.setTypeface(null, android.graphics.Typeface.BOLD);
            styleMorphismButton(btnSave, 0xFF00E5FF, 0xFF050811);
            LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            blp.setMargins(0, (int)(14 * getResources().getDisplayMetrics().density), 0, 0);
            btnSave.setLayoutParams(blp);
            btnSave.setOnClickListener(v -> {
                String name = etName.getText().toString().trim();
                String age = etAge.getText().toString().trim();
                String blood = selectedBlood[0];
                String bike = etBike.getText().toString().trim();

                if (name.isEmpty()) name = "Rider";
                if (age.isEmpty()) age = "24";
                if (bike.isEmpty()) bike = "MH-12-AB-1234";

                RiderProfile profile = new RiderProfile("BIKE-101", name, age, bike, blood, "Emergency rider profile");
                profile.save(MainActivity.this);
                RiderProfile.setProfileCreated(MainActivity.this, true);

                unlockDashboard(bike, name);
                dialog.dismiss();

                Toast.makeText(MainActivity.this, "Profile Saved! Welcome, " + name, Toast.LENGTH_SHORT).show();

                // Open simplified setup & Bluetooth guide directly after profile creation
                new Handler(Looper.getMainLooper()).postDelayed(MainActivity.this::showOnboardingTutorialDialog, 300);
            });
            root.addView(btnSave);

            scrollView.addView(root);
            dialog.setContentView(scrollView);
            if (!isFinishing() && !(Build.VERSION.SDK_INT >= 17 && isDestroyed())) {
                dialog.show();
            }
        } catch (Throwable e) {
            Log.e(TAG, "Profile creation dialog error: " + e.getMessage());
        }
    }

    private TextView createFieldLabel(String label) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(0xFF38BDF8);
        tv.setTextSize(11f);
        tv.setTypeface(null, android.graphics.Typeface.BOLD);
        tv.setPadding(0, 0, 0, (int)(4 * getResources().getDisplayMetrics().density));
        return tv;
    }

    private EditText createMorphismInput(String text, String hint) {
        EditText et = new EditText(this);
        et.setText(text != null ? text : "");
        et.setHint(hint);
        et.setHintTextColor(0xFF64748B);
        et.setTextColor(0xFFFFFFFF);
        et.setTextSize(13f);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF1E293B);
        bg.setCornerRadius(14f);
        bg.setStroke(1, 0xFF334155);
        et.setBackground(bg);
        int pad = (int)(10 * getResources().getDisplayMetrics().density);
        et.setPadding(pad, pad, pad, pad);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, (int)(10 * getResources().getDisplayMetrics().density));
        et.setLayoutParams(lp);
        return et;
    }

    private void showOnboardingTutorialDialog() {
        if (isFinishing()) return;
        try {
            final android.app.Dialog dialog = new android.app.Dialog(this);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            if (dialog.getWindow() != null) {
                dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            }

            ScrollView scrollView = new ScrollView(this);
            scrollView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            GradientDrawable rootBg = new GradientDrawable();
            rootBg.setColor(0xF50B1120);
            rootBg.setCornerRadius(32f);
            rootBg.setStroke(3, 0xFF00E5FF);
            root.setBackground(rootBg);
            int p = (int) (18 * getResources().getDisplayMetrics().density);
            root.setPadding(p, p, p, p);

            // Header Title
            TextView tvTitle = new TextView(this);
            tvTitle.setText("🛡️ GUARDIAN SETUP & HARDWARE GUIDE");
            tvTitle.setTextColor(0xFF00E5FF);
            tvTitle.setTextSize(17f);
            tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
            root.addView(tvTitle);

            TextView tvSub = new TextView(this);
            tvSub.setText("Follow these 3 quick steps for hardware pairing and 100% background reliability.");
            tvSub.setTextColor(0xFF94A3B8);
            tvSub.setTextSize(11.5f);
            tvSub.setPadding(0, 4, 0, (int)(12 * getResources().getDisplayMetrics().density));
            root.addView(tvSub);

            // Card 1: 📡 Simple Bluetooth Connection Guide
            LinearLayout card1 = createTutorialCard(
                "1. 📡 HOW TO CONNECT ESP32 VIA BLUETOOTH",
                "• Step 1: Turn ON both your Helmet Unit and Bike Receiver module.\n" +
                "• Step 2: Ensure Phone Bluetooth & GPS Location are turned ON.\n" +
                "• Step 3: Tap '⚡ START GUARDIAN LIVE ENGINE' on the dashboard.\n" +
                "• Guardian automatically scans and connects to 'Guardian_Helmet' over BLE (< 2 seconds)!\n" +
                "• Live speed, helmet status, and MPU crash telemetry will immediately stream.",
                0xFF00E5FF
            );
            root.addView(card1);

            // Card 2: 🔋 Unrestricted Battery Mode
            LinearLayout card2 = createTutorialCard(
                "2. 🔋 UNRESTRICTED BATTERY (MUST-DO)",
                "Android battery optimizers silently kill background tracking when your phone is locked in your pocket.\n" +
                "Set Guardian to 'Unrestricted' battery mode so emergency crash detection never sleeps.",
                0xFFF59E0B
            );
            Button btnGrantBattery = new Button(this);
            btnGrantBattery.setText("⚙️ SET UNRESTRICTED BATTERY NOW");
            btnGrantBattery.setTextSize(11f);
            styleMorphismButton(btnGrantBattery, 0xFFF59E0B, 0xFF0F172A);
            btnGrantBattery.setOnClickListener(v -> requestBatteryOptimizationExemption());
            card2.addView(btnGrantBattery);
            root.addView(card2);

            // Card 3: 👥 Emergency Contacts & Single SOS SMS + Instant Auto-Call
            LinearLayout card3 = createTutorialCard(
                "3. 👥 EMERGENCY RESCUE WORKFLOW",
                "• Add your family / emergency contacts below.\n" +
                "• Upon crash impact (>4.0G), Guardian immediately sends ONE concise SMS with your real-time Google Maps link, coordinates, blood group, age, and bike number.\n" +
                "• Guardian auto-dials your contacts sequentially — if a contact cuts or does not answer, it immediately dials your next contact!",
                0xFF10B981
            );
            root.addView(card3);

            // Dismiss Button
            Button btnDismiss = new Button(this);
            btnDismiss.setText("GOT IT — START RIDING 🚀");
            btnDismiss.setTextSize(13.5f);
            btnDismiss.setTypeface(null, android.graphics.Typeface.BOLD);
            styleMorphismButton(btnDismiss, 0xFF00E5FF, 0xFF050811);
            LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            dlp.setMargins(0, (int)(14 * getResources().getDisplayMetrics().density), 0, 0);
            btnDismiss.setLayoutParams(dlp);
            btnDismiss.setOnClickListener(v -> {
                prefs.edit().putBoolean("HAS_SEEN_TUTORIAL_V3", true).apply();
                dialog.dismiss();
            });
            root.addView(btnDismiss);

            scrollView.addView(root);
            dialog.setContentView(scrollView);
            if (!isFinishing() && !(Build.VERSION.SDK_INT >= 17 && isDestroyed())) {
                dialog.show();
            }
        } catch (Throwable e) {
            Log.e(TAG, "Tutorial dialog error: " + e.getMessage());
        }
    }

    private LinearLayout createTutorialCard(String title, String body, int accentColor) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xEE1E293B);
        bg.setCornerRadius(18f);
        bg.setStroke(2, accentColor);
        card.setBackground(bg);
        int p = (int) (12 * getResources().getDisplayMetrics().density);
        card.setPadding(p, p, p, p);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, (int)(10 * getResources().getDisplayMetrics().density));
        card.setLayoutParams(lp);

        TextView tvTitle = new TextView(this);
        tvTitle.setText(title);
        tvTitle.setTextColor(accentColor);
        tvTitle.setTextSize(12.5f);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        card.addView(tvTitle);

        TextView tvBody = new TextView(this);
        tvBody.setText(body);
        tvBody.setTextColor(0xFFCBD5E1);
        tvBody.setTextSize(11f);
        tvBody.setPadding(0, 4, 0, (int)(6 * getResources().getDisplayMetrics().density));
        card.addView(tvBody);

        return card;
    }

    public void dialEmergencyCall(final String phone) {
        runOnUiThread(() -> {
            try {
                Intent callIntent = new Intent(Intent.ACTION_CALL);
                callIntent.setData(Uri.parse("tel:" + phone));
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(callIntent);
            } catch (Exception e) {
                try {
                    Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                    dialIntent.setData(Uri.parse("tel:" + phone));
                    dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(dialIntent);
                } catch (Exception ignored) {}
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (instance == this) instance = null;
        try {
            unregisterReceiver(telemetryReceiver);
        } catch (Exception ignored) {}
    }
}
