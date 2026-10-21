import java.util.Base64

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

val dartDefines = (project.findProperty("dart-defines") as? String)
    ?.split(",")?.mapNotNull { encoded ->
        runCatching { String(Base64.getDecoder().decode(encoded)) }.getOrNull()
    }?.mapNotNull { definition ->
        val parts = definition.split("=", limit = 2)
        if (parts.size == 2) parts[0] to parts[1] else null
    }?.toMap() ?: emptyMap()
val backendMode = dartDefines["BACKEND_MODE"] ?: "firebase"
val privateDeviceSetup = backendMode == "firebase" &&
    dartDefines["STORE_STAGE"] == "private-draft" &&
    dartDefines["APP_CHECK_PROVIDER"] == "debug" &&
    dartDefines["INTERNAL_BUILD"] == "true"
val ownerKeystore = System.getenv("NN_KEYSTORE_PATH")
val ownerStorePassword = System.getenv("NN_KEYSTORE_PASSWORD")
val ownerKeyAlias = System.getenv("NN_KEY_ALIAS")
val ownerKeyPassword = System.getenv("NN_KEY_PASSWORD")
val hasOwnerSigning = listOf(ownerKeystore, ownerStorePassword, ownerKeyAlias, ownerKeyPassword)
    .all { !it.isNullOrBlank() }

android {
    namespace = "com.narayananaturals.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.narayananaturals.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        buildConfigField("boolean", "PRIVATE_DEVICE_SETUP", privateDeviceSetup.toString())
        manifestPlaceholders["appLabel"] = when (backendMode) {
            "demo" -> "Narayana Preview"
            "emulator" -> "Narayana Emulator"
            else -> "Narayana Naturals"
        }
        // Cleartext is confined to an explicitly compiled emulator build.
        manifestPlaceholders["allowCleartext"] = (backendMode == "emulator").toString()
    }

    signingConfigs {
        if (hasOwnerSigning) {
            create("ownerRelease") {
                storeFile = file(ownerKeystore!!)
                storePassword = ownerStorePassword
                keyAlias = ownerKeyAlias
                keyPassword = ownerKeyPassword
            }
        }
    }

    buildTypes {
        release {
            // Without an owner keystore this is an internal test APK, despite
            // release optimization. It is never described as store-ready.
            signingConfig = signingConfigs.getByName(if (hasOwnerSigning) "ownerRelease" else "debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // Matches the resolved FlutterFire SDK; the private device channel uses
    // FirebaseApp directly, so it needs an explicit native compile dependency.
    implementation(platform("com.google.firebase:firebase-bom:35.0.0"))
    implementation("com.google.firebase:firebase-common")
}

flutter {
    source = "../.."
}
