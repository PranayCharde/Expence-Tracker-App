package com.pranay.spendwise.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

class SmsBroadcastReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SpendWiseSmsReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            try {
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                if (messages.isNullOrEmpty()) return

                val sender = messages[0].displayOriginatingAddress ?: ""
                val fullBody = StringBuilder()
                var timestamp = System.currentTimeMillis()

                for (sms in messages) {
                    sms.displayMessageBody?.let { fullBody.append(it) }
                    timestamp = sms.timestampMillis
                }

                val body = fullBody.toString()
                Log.d(TAG, "SMS Received from: $sender")

                ExpoSmsDetectorModule.sendSmsEvent(sender, body, timestamp)
            } catch (e: Exception) {
                Log.e(TAG, "Error handling incoming SMS", e)
            }
        }
    }
}

