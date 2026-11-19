package com.sankalp.smarthelmet;

import org.json.JSONObject;

public class ContactItem {
    public String id;
    public String name;
    public String phone;
    public String relation;
    public boolean isPrimary;

    public ContactItem(String id, String name, String phone, String relation, boolean isPrimary) {
        this.id = SecuritySanitizer.sanitizeText(id, String.valueOf(System.currentTimeMillis()));
        this.name = SecuritySanitizer.sanitizeText(name, "Emergency Contact");
        this.phone = SecuritySanitizer.sanitizePhone(phone);
        this.relation = SecuritySanitizer.sanitizeText(relation, "Family");
        this.isPrimary = isPrimary;
    }

    public JSONObject toJson() {
        JSONObject obj = new JSONObject();
        try {
            obj.put("id", id);
            obj.put("name", name);
            obj.put("phone", phone);
            obj.put("relation", relation);
            obj.put("isPrimary", isPrimary);
        } catch (Exception ignored) {}
        return obj;
    }

    public static ContactItem fromJson(JSONObject obj) {
        if (obj == null) return null;
        String id = obj.optString("id", String.valueOf(System.currentTimeMillis()));
        String name = obj.optString("name", "Emergency Contact");
        String phone = obj.optString("phone", "");
        String relation = obj.optString("relation", "Family");
        boolean isPrimary = obj.optBoolean("isPrimary", false);
        return new ContactItem(id, name, phone, relation, isPrimary);
    }
}
