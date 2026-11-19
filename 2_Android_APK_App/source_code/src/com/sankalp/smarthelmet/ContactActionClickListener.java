package com.sankalp.smarthelmet;

import android.view.View;

public class ContactActionClickListener implements View.OnClickListener {
    private MainActivity activity;
    private String phone;
    private String action;
    private String contactId;

    public ContactActionClickListener(MainActivity activity, String phone, String action, String contactId) {
        this.activity = activity;
        this.phone = phone;
        this.action = action;
        this.contactId = contactId;
    }

    @Override
    public void onClick(View v) {
        if (activity != null) {
            activity.handleContactAction(action, contactId, phone);
        }
    }
}
