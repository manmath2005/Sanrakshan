package com.sankalp.smarthelmet;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class ContactStorage {
    private static final String PREF_NAME = "SmartHelmetContacts";
    private static final String KEY_CONTACTS = "CONTACTS_JSON_ARRAY";

    public static List<ContactItem> loadContacts(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        List<ContactItem> list = new ArrayList<ContactItem>();

        // If never initialized before on first install
        if (!prefs.contains(KEY_CONTACTS)) {
            list.add(new ContactItem("1", "Mom (Primary)", "+919876543210", "Mother", true));
            list.add(new ContactItem("2", "Emergency Police", "112", "Emergency Services", false));
            list.add(new ContactItem("3", "Dr. Rao (Physician)", "+919822012345", "Doctor", false));
            saveContacts(context, list);
            return list;
        }

        String jsonStr = prefs.getString(KEY_CONTACTS, "[]");
        try {
            JSONArray arr = new JSONArray(jsonStr);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                ContactItem item = ContactItem.fromJson(obj);
                if (item != null && item.phone != null && !item.phone.trim().isEmpty()) {
                    item.phone = SecuritySanitizer.sanitizePhone(item.phone);
                    list.add(item);
                }
            }
        } catch (Exception ignored) {}

        return list;
    }

    public static void saveContacts(Context context, List<ContactItem> list) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        JSONArray arr = new JSONArray();
        for (int i = 0; i < list.size(); i++) {
            arr.put(list.get(i).toJson());
        }
        // Use commit() for immediate synchronous disk write
        prefs.edit().putString(KEY_CONTACTS, arr.toString()).commit();
    }

    public static void addContact(Context context, String name, String phone, String relation, boolean isPrimary) {
        List<ContactItem> list = loadContacts(context);
        String id = String.valueOf(System.currentTimeMillis());
        if (isPrimary || list.isEmpty()) {
            for (int i = 0; i < list.size(); i++) {
                list.get(i).isPrimary = false;
            }
            isPrimary = true;
        }
        list.add(new ContactItem(id, name, phone, relation, isPrimary));
        saveContacts(context, list);
    }

    public static void deleteContact(Context context, String id) {
        List<ContactItem> list = loadContacts(context);
        boolean hadPrimary = false;
        for (int i = list.size() - 1; i >= 0; i--) {
            if (list.get(i).id.equals(id)) {
                if (list.get(i).isPrimary) hadPrimary = true;
                list.remove(i);
            }
        }
        if (hadPrimary && !list.isEmpty()) {
            list.get(0).isPrimary = true;
        }
        saveContacts(context, list);
    }

    public static void setPrimary(Context context, String id) {
        List<ContactItem> list = loadContacts(context);
        for (int i = 0; i < list.size(); i++) {
            list.get(i).isPrimary = list.get(i).id.equals(id);
        }
        saveContacts(context, list);
    }

    public static ContactItem getPrimaryContact(Context context) {
        List<ContactItem> list = loadContacts(context);
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).isPrimary) return list.get(i);
        }
        return list.isEmpty() ? null : list.get(0);
    }
}
