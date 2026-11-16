package com.pranay.spendwise.sms

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentLinkedQueue

class ExpoSmsDetectorModule : Module() {
    companion object {
        private const val TAG = "ExpoSmsDetector"
        private var instance: WeakReference<ExpoSmsDetectorModule>? = null
        private var isListening: Boolean = true
        private val pendingEvents = ConcurrentLinkedQueue<Map<String, Any>>()

        fun sendSmsEvent(sender: String, body: String, timestamp: Long) {
            val event = mapOf(
                "sender" to sender,
                "body" to body,
                "timestamp" to timestamp
            )
            Log.d(TAG, "sendSmsEvent called for sender: $sender, isListening: $isListening")

            val module = instance?.get()
            if (module != null && isListening) {
                try {
                    module.sendEvent("onSmsReceived", event)
                    Log.d(TAG, "Dispatched onSmsReceived event to JS successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to dispatch onSmsReceived event", e)
                    pendingEvents.add(event)
                }
            } else {
                Log.d(TAG, "Module instance not ready or listening off, queueing pending event")
                pendingEvents.add(event)
            }
        }

        fun flushPendingEvents() {
            val module = instance?.get() ?: return
            while (!pendingEvents.isEmpty()) {
                val event = pendingEvents.poll() ?: break
                try {
                    module.sendEvent("onSmsReceived", event)
                    Log.d(TAG, "Flushed pending SMS event to JS")
                } catch (e: Exception) {
                    Log.e(TAG, "Error flushing event", e)
                }
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoSmsDetector")

        Events("onSmsReceived")

        OnCreate {
            Log.d(TAG, "ExpoSmsDetectorModule created")
            instance = WeakReference(this@ExpoSmsDetectorModule)
            flushPendingEvents()
        }

        OnDestroy {
            Log.d(TAG, "ExpoSmsDetectorModule destroyed")
            if (instance?.get() == this@ExpoSmsDetectorModule) {
                instance = null
            }
        }

        Function("isAvailable") {
            true
        }

        Function("startListening") {
            isListening = true
            Log.d(TAG, "startListening invoked by JS")
            flushPendingEvents()
            true
        }

        Function("stopListening") {
            isListening = false
            Log.d(TAG, "stopListening invoked by JS")
            true
        }

        AsyncFunction("getRecentSms") { limit: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
            val smsList = mutableListOf<Map<String, Any>>()
            try {
                val uri = android.net.Uri.parse("content://sms/inbox")
                val projection = arrayOf("address", "body", "date")
                val safeLimit = if (limit in 1..100) limit else 20
                val cursor = context.contentResolver.query(
                    uri,
                    projection,
                    null,
                    null,
                    "date DESC LIMIT $safeLimit"
                )
                cursor?.use {
                    val addressIdx = it.getColumnIndex("address")
                    val bodyIdx = it.getColumnIndex("body")
                    val dateIdx = it.getColumnIndex("date")
                    while (it.moveToNext()) {
                        val sender = if (addressIdx != -1) it.getString(addressIdx) ?: "" else ""
                        val body = if (bodyIdx != -1) it.getString(bodyIdx) ?: "" else ""
                        val date = if (dateIdx != -1) it.getLong(dateIdx) else System.currentTimeMillis()
                        smsList.add(mapOf(
                            "sender" to sender,
                            "body" to body,
                            "timestamp" to date
                        ))
                    }
                }
                Log.d(TAG, "Retrieved ${smsList.size} recent SMS from inbox")
            } catch (e: Exception) {
                Log.e(TAG, "Error querying SMS inbox", e)
            }
            smsList
        }
    }
}

