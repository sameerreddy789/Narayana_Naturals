# Narayana Naturals Android app

Flutter customer app for the [shared Narayana Naturals store](../../README.md).
It uses the same Firebase Auth users, Firestore catalogue/cart/address/orders,
and `asia-south1` callable Functions as the Next.js website. Guidance progress
is specific to Android because the native navigation differs from the web.
The owner manages orders, pack prices and available stock through the website.

## Run and test

Use Flutter 3.41.6 / Dart 3.11.4, an Android SDK compatible with Flutter's
compile/target versions, and Java 21 or a compatible newer version. The tested
Windows installation uses Flutter at `C:\flutter` and SDK at `C:\android-sdk`.
Android uses Gradle 8.14, AGP 8.11.1, Kotlin 2.4.21 and R8 9.1.57. The newer Kotlin
compiler is required by the Firebase Auth Android library's 2.4 metadata;
these versions are within Kotlin's published compatibility range. The build
also disables incremental Kotlin caches to support a project on D: with a
Pub cache on C:, and bounds Gradle workers/memory for local and CI builds.
Run these commands from `apps/mobile`:

```powershell
flutter pub get --enforce-lockfile
flutter analyze
flutter test
flutter run --dart-define=BACKEND_MODE=demo
```

The tests cover account isolation, hydration before cart writes, guest merge,
unsaved cart recovery, stable checkout retries after an ambiguous response,
confirmation despite cart-cleanup failure, guidance persistence, and critical
customer screens. Widget checks include a narrow Telugu screen with large
text and dark theme, system back navigation, and wider navigation rails.

## Choose a backend

| Define | Connection | Intended use |
| --- | --- | --- |
| `BACKEND_MODE=demo` | Device-local sample data, no Firebase initialization | Standalone UI preview; no synchronization with the website |
| `BACKEND_MODE=emulator` | Local Auth 9099, Firestore 8080, Functions 5001 in `demo-narayana-naturals` | Connected development with the website's emulator mode |
| `BACKEND_MODE=firebase` (default) | Registered `narayananaturals-6b5aa` project | Actual Firebase configuration; cloud provisioning is required |

A Firebase failure displays an error with a retry action. It never changes
to demo mode or creates a sample order. Online payments are unavailable;
only a server-quoted, COD-eligible PIN can complete checkout.

Start and seed the shared emulators using the [root tutorial](../../README.md).
An Android emulator reaches the Windows host through `10.0.2.2`:

```powershell
flutter run --dart-define=BACKEND_MODE=emulator --dart-define=EMULATOR_HOST=10.0.2.2
```

For a USB-connected Android device, preserve the services' loopback binding
and forward their ports instead of exposing them on the network:

```powershell
adb reverse tcp:9099 tcp:9099
adb reverse tcp:8080 tcp:8080
adb reverse tcp:5001 tcp:5001
flutter run --dart-define=BACKEND_MODE=emulator --dart-define=EMULATOR_HOST=127.0.0.1
```

Emulator builds alone enable cleartext HTTP. Demo and Firebase builds keep
cleartext disabled. The application label identifies the compiled mode:
Narayana Preview, Narayana Emulator, or Narayana Naturals. These builds share
the package ID, so installing another mode replaces the installed app.

Use fixture customer phone `6000000001` to see the website customer's cart,
saved address and orders. The emulated OTP is available in the Auth Emulator
UI or verification-code endpoint; no real SMS is sent. Local sample PINs
`517001` and `517501` support COD. The seeded shared courier rules also
support preview COD; a PIN configured with `codAllowed:false` cannot
complete checkout while online payments are off. Standalone demo data is
independent of the shared seed and includes its own illustrative charges.

## Build APKs

```powershell
flutter build apk --release --dart-define=BACKEND_MODE=demo
flutter build apk --release --dart-define=BACKEND_MODE=emulator --dart-define=EMULATOR_HOST=10.0.2.2
flutter build apk --release --dart-define=BACKEND_MODE=firebase
```

Each command writes `build/app/outputs/flutter-apk/app-release.apk`; copy it
to a mode-specific filename before running the next command. Generated APKs,
build output, SDK paths and signing secrets are excluded from source control.
The standalone preview works without a running development server. The
connected emulator APK requires the local services; the Firebase APK requires
the live project setup described below.

Release optimization and signing are separate. Without an owner keystore,
Gradle signs the release build with the machine's Android debug key for
internal installation. Public distribution needs an owner-held release key
or Play App Signing. To use an existing owner keystore, supply all four
environment variables before building:

| Variable | Value |
| --- | --- |
| `NN_KEYSTORE_PATH` | Absolute path to the owner's keystore |
| `NN_KEYSTORE_PASSWORD` | Keystore password |
| `NN_KEY_ALIAS` | Signing key alias |
| `NN_KEY_PASSWORD` | Signing key password |

Keep these values in a secure local environment or CI secrets. Do not commit
them. The current Android registration is `com.narayananaturals.app`, with
public client configuration in `android/app/google-services.json`. A change
of signing key requires corresponding Firebase certificate registration.

## Activate the live backend

The registered Android and web apps point to the same project. The measured
cloud setup on 20 October 2026 has billing disabled, Phone Auth disabled and
no Firestore database. Owner CLI authorization is working. Enabling the
services and deploying the backend remain deliberate release steps.

Follow [backend setup](../../docs/BACKEND-SETUP.md) to provision Firestore,
enable Phone Auth/India SMS policy, configure production App Check and deploy
rules/indexes/functions. Add confirmed catalogue/inventory/PIN policies and a
trusted owner claim before enabling ordering. Sample fixtures cannot enable
production checkout.

For an App Check registered internal Firebase build, use
`APP_CHECK_PROVIDER=debug` and register its debug token in the console.
For an appropriately signed and configured public build, use
`APP_CHECK_PROVIDER=playIntegrity` and `INTERNAL_BUILD=false`. Provider setup
must precede real callable testing; the current internal Firebase APK uses
`APP_CHECK_PROVIDER=off` and is intended to inspect setup/error behavior.

Payments, courier bookings, push notifications, feedback, batch ledgers and
customer self-cancellation are outside the implemented v1. Story, delivery,
help and policy screens are present; final business facts, product photos,
support contact and approved policy copy must be supplied by the owner.
