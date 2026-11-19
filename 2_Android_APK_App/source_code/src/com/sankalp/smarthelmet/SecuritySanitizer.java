package com.sankalp.smarthelmet;

import java.util.regex.Pattern;

public class SecuritySanitizer {

    // E.164 and Standard Phone Regex: allows +, numbers, spaces, dashes (max 18 chars)
    private static final Pattern PHONE_PATTERN = Pattern.compile("^[+]?[0-9\\s\\-]{3,18}$");
    
    // Alphanumeric + spaces + standard punctuation for names
    private static final Pattern SAFE_TEXT_PATTERN = Pattern.compile("^[a-zA-Z0-9\\s\\.\\-_#@()]{1,60}$");

    public static String sanitizePhone(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (Character.isDigit(c)) {
                sb.append(c);
            } else if (c == '+' && sb.length() == 0) {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public static String sanitizeText(String raw, String defaultVal) {
        if (raw == null || raw.trim().isEmpty()) return defaultVal;
        String trimmed = raw.trim();
        if (SAFE_TEXT_PATTERN.matcher(trimmed).matches()) {
            return trimmed;
        }
        // Filter out dangerous control characters
        return trimmed.replaceAll("[^a-zA-Z0-9\\s\\.\\-_#@()]", "");
    }
}
