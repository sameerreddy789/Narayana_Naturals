# Narayana Naturals Android app

Native Flutter customer app for the [shared store](../../README.md).
The Next.js website and app share Firebase email/password identities,
Realtime Database records and the Node commerce API. Guide progress is
specific to Android because navigation differs from the website.
The web owner dashboard manages both channels.

## Run and verify

The tested toolchain is Flutter 3.41.6 / Dart 3.11.4, Android SDK
compile/target 36, Gradle 8.14, AGP 8.11.1, Kotlin 2.4.21 and R8 9.1.57.
Windows installations are `C:\flutter` and `C:\android-sdk`.
Use Java 21 or a compatible newer version.

```powershell
flutter pub get --enforce-lockfile
flutter analyze
flutter test
flutter run --dart-define=BACKEND_MODE=demo
```

The tests cover account isolation, account hydration before writes,
guest cart merge, unsaved cart recovery, checkout retry recovery,
confirmation despite ancillary cart cleanup failure and guide persistence.
Widget tests cover narrow Telugu layouts with large text and dark theme,
system back navigation and wider navigation rails.

## Backend modes

| Define | Connection |
| --- | --- |
| `BACKEND_MODE=demo` | Device-local sample data; no Firebase or cross-client sync |
| `BACKEND_MODE=emulator` | Auth 9099, RTDB 9000, Node API 5002 in the shared local demo project |
| `BACKEND_MODE=firebase` (default) | Registered owner Firebase project; HTTPS API and cloud setup required |

A connection failure displays an error and retry action. Live orders use
server quotes; unavailable configuration cannot create a sample purchase.

Start the local services using the [root tutorial](../../README.md).
The Android emulator reaches the Windows host through `10.0.2.2`:

```powershell
flutter run --dart-define=BACKEND_MODE=emulator --dart-define=EMULATOR_HOST=10.0.2.2
```

Sign in with `customer@narayana.test` / `NarayanaDemo123!` to read the same
cart, default address and orders as the website. New email accounts also
work in the emulator. Delivery phone numbers are contact information,
separate from account authentication.

For a USB device, forward the local ports and compile a matching host:

```powershell
adb reverse tcp:9099 tcp:9099
adb reverse tcp:9000 tcp:9000
adb reverse tcp:5002 tcp:5002
flutter run --dart-define=BACKEND_MODE=emulator --dart-define=EMULATOR_HOST=127.0.0.1
```

The standard emulator APK uses `10.0.2.2`; port forwarding alone cannot
change that compiled host. Emulator builds permit cleartext for local APIs.
The modes share the package ID and replace one another when installed.

## Build and preserve APKs

```powershell
flutter build apk --release --dart-define=BACKEND_MODE=demo --dart-define=INTERNAL_BUILD=true
flutter build apk --release --dart-define=BACKEND_MODE=emulator --dart-define=INTERNAL_BUILD=true
flutter build apk --release --dart-define=BACKEND_MODE=emulator --dart-define=EMULATOR_HOST=127.0.0.1 --dart-define=INTERNAL_BUILD=true
flutter build apk --release --dart-define=BACKEND_MODE=firebase --dart-define=INTERNAL_BUILD=true
```

Each command overwrites `build/app/outputs/flutter-apk/app-release.apk`.
Copy the output to a mode-specific filename before the next build.
The provided `artifacts/narayana-naturals-usb.apk` is the `127.0.0.1` build
for a physical phone with all three `adb reverse` mappings above. The
`narayana-naturals-emulator.apk` build uses `10.0.2.2` for an Android emulator.
Generated files, SDK paths, credentials, signing keys and APKs are ignored.
GitHub Actions uploads an internal standalone preview APK.

Without an owner keystore, release builds use the machine's Android debug
key for internal installation. Public distribution needs an owner-held
release key or Play App Signing. Existing owner signing uses these secret
environment variables:

| Variable | Value |
| --- | --- |
| `NN_KEYSTORE_PATH` | Absolute owner keystore path |
| `NN_KEYSTORE_PASSWORD` | Keystore password |
| `NN_KEY_ALIAS` | Signing alias |
| `NN_KEY_PASSWORD` | Signing key password |

Keep them outside source control. The package is `com.narayananaturals.app`;
`android/app/google-services.json` contains public Android client config.
Firebase certificate registration must match the distribution signature.

## Live operation

Follow [backend setup](../../docs/BACKEND-SETUP.md). The owner project already
has email/password Auth and an active Realtime Database with billing disabled.
The Node API needs separate HTTPS hosting and secure Admin credentials.
Configure the same API URL for both clients:

```powershell
flutter build apk --release --dart-define=BACKEND_MODE=firebase --dart-define=COMMERCE_API_URL=https://your-confirmed-api-host --dart-define=APP_CHECK_PROVIDER=playIntegrity --dart-define=INTERNAL_BUILD=false
```

Replace the example URL with the actual deployed endpoint. Production API
calls require App Check. Use `APP_CHECK_PROVIDER=debug` only for a registered
internal debug token; use `playIntegrity` for the configured public app.

The current internal Firebase APK uses App Check off and has no hosted API
URL. It is for checking configuration and setup error behavior. Real ordering
requires the hosted API, deployed RTDB rules, confirmed business data and
owner release setup. The app includes COD, order history/status/reorder,
bilingual screens and onboarding. Merchant payments, automated courier
bookings, notifications and feedback are future integrations.
