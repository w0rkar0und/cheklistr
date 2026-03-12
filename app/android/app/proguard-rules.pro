# ── Capacitor WebView JS bridge ──────────────────────────────
# Keep the JavaScript interface so the WebView ↔ native bridge works
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin classes (registered by reflection)
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# ── Capacitor plugins used by Cheklistr ─────────────────────
-keep class com.capacitorjs.plugins.camera.** { *; }
-keep class com.capacitorjs.plugins.geolocation.** { *; }
-keep class com.capacitorjs.plugins.preferences.** { *; }
-keep class com.capacitorjs.plugins.network.** { *; }
-keep class com.capacitorjs.plugins.splashscreen.** { *; }
-keep class com.aparajita.capacitor.biometricauth.** { *; }

# ── AndroidX ────────────────────────────────────────────────
-keep class androidx.core.content.FileProvider { *; }

# ── Preserve line numbers for crash reporting ───────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
