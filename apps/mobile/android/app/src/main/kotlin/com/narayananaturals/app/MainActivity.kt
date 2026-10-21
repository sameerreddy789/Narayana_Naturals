package com.narayananaturals.app

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.os.Build
import android.os.PersistableBundle
import com.google.firebase.FirebaseApp
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Public builds have no registration channel. Each private installation
        // keeps its SDK-generated secret; it is never returned to Dart or logged.
        if (!BuildConfig.PRIVATE_DEVICE_SETUP) return
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "narayananaturals/private_setup")
            .setMethodCallHandler { call, result ->
                if (call.method != "copyDeviceCode") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                try {
                    val app = FirebaseApp.getInstance()
                    // Storage format verified against the resolved Firebase
                    // App Check debug SDK. Recheck this on SDK upgrades.
                    val prefs = getSharedPreferences(
                        "com.google.firebase.appcheck.debug.store.${app.persistenceKey}", MODE_PRIVATE
                    )
                    val code = prefs.getString("com.google.firebase.appcheck.debug.DEBUG_SECRET", null)
                    if (code == null || !Regex("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$").matches(code)) {
                        result.success(false)
                        return@setMethodCallHandler
                    }
                    val clip = ClipData.newPlainText("Narayana private device registration", code)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        clip.description.extras = PersistableBundle().apply {
                            putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
                        }
                    }
                    (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(clip)
                    result.success(true)
                } catch (_: Exception) {
                    result.error("DEVICE_SETUP_UNAVAILABLE", "Device registration is unavailable. Reopen the app and retry.", null)
                }
            }
    }
}
