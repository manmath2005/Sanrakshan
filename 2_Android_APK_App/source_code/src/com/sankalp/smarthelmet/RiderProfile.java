package com.sankalp.smarthelmet;

import android.content.Context;
import android.content.SharedPreferences;

public class RiderProfile {
    private static final String PREF_NAME = "SmartHelmetRiderProfile";
    private static final String KEY_PROFILE_CREATED = "PROFILE_CREATED";

    public String riderId;
    public String riderName;
    public String age;
    public String vehicleNumber;
    public String bloodGroup;
    public String emergencyNotes;

    public RiderProfile(String riderId, String riderName, String age, String vehicleNumber, String bloodGroup, String emergencyNotes) {
        this.riderId = (riderId != null && !riderId.isEmpty()) ? riderId : "BIKE-101";
        this.riderName = (riderName != null && !riderName.isEmpty()) ? riderName : "Rider";
        this.age = (age != null && !age.isEmpty()) ? age : "24";
        this.vehicleNumber = (vehicleNumber != null && !vehicleNumber.isEmpty()) ? vehicleNumber : "MH-12-AB-1234";
        this.bloodGroup = (bloodGroup != null && !bloodGroup.isEmpty()) ? bloodGroup : "O+";
        this.emergencyNotes = (emergencyNotes != null) ? emergencyNotes : "No known allergies";
    }

    public RiderProfile(String riderId, String riderName, String vehicleNumber, String bloodGroup, String emergencyNotes) {
        this(riderId, riderName, "24", vehicleNumber, bloodGroup, emergencyNotes);
    }

    public static boolean isProfileCreated(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_PROFILE_CREATED, false);
    }

    public static void setProfileCreated(Context context, boolean created) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_PROFILE_CREATED, created).apply();
    }

    public static RiderProfile load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String id = prefs.getString("RIDER_ID", "BIKE-101");
        String name = prefs.getString("RIDER_NAME", "Manmath");
        String age = prefs.getString("RIDER_AGE", "24");
        String veh = prefs.getString("VEHICLE_NO", "MH-12-AB-1234");
        String blood = prefs.getString("BLOOD_GROUP", "O+");
        String notes = prefs.getString("EMERGENCY_NOTES", "No known drug allergies");

        // Cross-sync with login prefs if available
        try {
            SharedPreferences loginPrefs = context.getSharedPreferences("SmartHelmetPrefs", Context.MODE_PRIVATE);
            if (loginPrefs.contains("SAVED_NAME") && (name == null || name.isEmpty() || name.equals("Rider"))) {
                name = loginPrefs.getString("SAVED_NAME", name);
            }
            if (loginPrefs.contains("SAVED_VEHICLE") && (veh == null || veh.isEmpty())) {
                veh = loginPrefs.getString("SAVED_VEHICLE", veh);
            }
        } catch (Exception ignored) {}

        return new RiderProfile(id, name, age, veh, blood, notes);
    }

    public void save(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("RIDER_ID", riderId)
            .putString("RIDER_NAME", riderName)
            .putString("RIDER_AGE", age)
            .putString("VEHICLE_NO", vehicleNumber)
            .putString("BLOOD_GROUP", bloodGroup)
            .putString("EMERGENCY_NOTES", emergencyNotes)
            .putBoolean(KEY_PROFILE_CREATED, true)
            .commit();
    }
}
