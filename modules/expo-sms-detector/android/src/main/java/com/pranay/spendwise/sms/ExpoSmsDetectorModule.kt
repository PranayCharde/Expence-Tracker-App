package com.pranay.spendwise.sms

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

class ExpoSmsDetectorModule : Module() {
    companion object {
        private var instance: WeakReference<ExpoSmsDetectorModule>? = null
        private var isListening: Boolean = true

        fun sendSmsEvent(sender: String, body: String, timestamp: Long) {
            if (!isListening) return
            val module = instance?.get() ?: return
            module.sendEvent("onSmsReceived", mapOf(
                "sender" to sender,
                "body" to body,
                "timestamp" to timestamp
            ))
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoSmsDetector")

        Events("onSmsReceived")

        OnCreate {
            instance = WeakReference(this@ExpoSmsDetectorModule)
        }

        OnDestroy {
            if (instance?.get() == this@ExpoSmsDetectorModule) {
                instance = null
            }
        }

        Function("isAvailable") {
            true
        }

        Function("startListening") {
            isListening = true
            true
        }

        Function("stopListening") {
            isListening = false
            true
        }
    }
}

