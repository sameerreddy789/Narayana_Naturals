# Narayana Naturals

A bilingual Next.js website, Flutter Android customer app and shared Firebase
Realtime Database backend for Narayana Naturals bull-driven wooden Ghani
groundnut oil. Customers use the same email account, catalogue, cart, default
delivery address and order history on both connected clients. The web owner
dashboard updates pack prices, available stock and order status.

The current **private client draft** uses the hosted website at
https://narayana-naturals.onrender.com and API at
https://narayana-naturals-api.onrender.com. It shows labelled example prices,
pending stock and only PIN **517502**, with COD, payments and order submission
disabled. See [the APK sharing and live setup guide](docs/LIVE-DRAFT-APK.md).

The production purchase implementation supports **cash on delivery for eligible PIN codes**.
The user's selected stack avoids Firebase billing: email/password Authentication,
Realtime Database and a separately hosted Node API. Firestore, SMS login and
Cloud Functions are not used. Hosting the Node API and monitoring free quotas
are separate operational responsibilities.

## Run the connected local version

Requirements: Node.js 22, npm, Java 21 or later, and Flutter 3.41.6 for Android.
From the project root, install and build:

```powershell
Set-Location 'D:\Hackathons\Narayana Naturals'
npm ci
npm run backend:install
npm run backend:build
```

Keep three terminals running in that directory.

Terminal 1 starts Firebase Authentication and Realtime Database emulators:

```powershell
npm run emulators
```

The launcher restores a previous local export when available and exports on
normal shutdown. Test accounts belong to this local environment; they are
separate from real Firebase accounts. Before stopping services or closing a
terminal, run `npm run emulators:save` in another terminal and wait for the
export confirmation. Then press Ctrl+C in the emulator terminal and wait for
shutdown. Force-ending a terminal or process can bypass automatic export.

Terminal 2 seeds sample data on first setup, then starts the Node API:

```powershell
npm run emulators:seed
npm run backend:start
```

Rerunning the seed resets sample catalogue, packed stock, rates and fixture
profiles. It preserves existing orders and addresses. It refuses production
projects and hosts outside loopback. Use it deliberately.

Terminal 3 starts the website:

```powershell
$env:NEXT_PUBLIC_BACKEND_MODE = 'emulator'
npm run dev
```

If you need a new environment file, copy `apps/web/.env.example` to
`apps/web/.env.local`. Preserve an existing owner environment file.
The process variable above selects the connected local mode for that run.

Open [the website](http://localhost:3000),
[owner dashboard](http://localhost:3000/admin),
[Emulator UI](http://127.0.0.1:4000), or
[API health](http://127.0.0.1:5002/health).
Health checks connectivity and the presence of storefront configuration; it
does not certify prices, delivery policies or readiness for real sales.

## Try both clients

| Local test account | Email |
| --- | --- |
| Customer | `customer@narayana.test` |
| Other customer | `other@narayana.test` |
| Owner with trusted admin claim | `owner@narayana.test` |

Their local test password is `NarayanaDemo123!`. These credentials work only
with the emulator fixtures. You can also create a new email account in the
local website or app. Password reset links remain in the Auth emulator; no
email is sent by the emulator.

1. Add a pack on the website and sign in with the customer fixture.
2. Start or skip the first-login guide. Use sample delivery details and PIN
   `517001`, review the complete server total, then place a preview COD order.
3. Run/install the emulator Android build and sign in with the same email.
   Check the shared cart, default address and order history.
4. Place an app order. A separate owner browser sees both website and Android
   orders. Update Received → Packed → Shipped → Delivered; active customer
   clients receive the status changes.
5. Use Order again to add packs at current prices and availability. Reorder
   starts a fresh checkout; it does not repeat the old payment or quote.

Local fixture PINs are `517001`, `517501` and `523201`. Courier examples
are `500001`, `110001`, `560001` and `600001`. The sample 1/2/5 L prices
are ₹450/₹900/₹2,250. Sample local delivery is free; the shared courier example
is ₹120 plus ₹25 per litre above two included litres. These are illustrative.
The standalone demo has independent sample rates and data.

## Android

From `apps/mobile`:

```powershell
flutter pub get --enforce-lockfile
flutter run --dart-define=BACKEND_MODE=emulator
flutter build apk --release --dart-define=BACKEND_MODE=demo
flutter build apk --release --dart-define=BACKEND_MODE=emulator
flutter build apk --release --dart-define=BACKEND_MODE=firebase
```

Every build writes `apps/mobile/build/app/outputs/flutter-apk/app-release.apk`.
Copy it before building another mode. Internal outputs are copied to the
ignored `artifacts/` directory:

| APK | Use |
| --- | --- |
| `narayana-naturals-preview.apk` | Standalone demonstration; no shared backend needed |
| `narayana-naturals-emulator.apk` | Connected Android emulator, website and local Node API |
| `narayana-naturals-usb.apk` | Physical Android phone connected to this laptop by USB |
| `narayana-naturals-firebase.apk` | Owner project configuration; live API/setup required |

The emulator APK uses `10.0.2.2` to reach Auth 9099, RTDB 9000 and Node 5002.
A physical device needs a matching host build and port forwarding; see the
[Android guide](apps/mobile/README.md). The APKs share
`com.narayananaturals.app`, so installing a different mode replaces the app.

The USB APK already uses `127.0.0.1`. With the local services running, connect
the phone, enable USB debugging, authorize the laptop and run:

```powershell
adb reverse tcp:9099 tcp:9099
adb reverse tcp:9000 tcp:9000
adb reverse tcp:5002 tcp:5002
adb install -r artifacts/narayana-naturals-usb.apk
```

When several devices are attached, use `adb -s <device-serial>` on each command.
The phone needs the USB connection and local services for this test build.

These are release-optimized internal builds signed with the Android debug key.
The Firebase APK without an HTTPS API URL displays a recoverable setup error
when checkout needs the order service. Public distribution requires owner
release signing, App Check and a hosted API.

## Implemented features

- Responsive branded website and native Flutter customer app.
- English/Telugu controls, commerce messages and guidance.
- One groundnut oil product, 1/2/5 L packs, quantity and availability controls.
- Guest cart, email sign-in/create account/reset password, shared signed-in cart.
- One saved default delivery address and exact PIN eligibility.
- Server-priced delivery quotes and COD order confirmation.
- Cross-channel order history, fulfillment status and Order again.
- First-login welcome, optional page tips, skip, dismiss and replay.
- Web owner overview, pack price/stock/availability editing and order updates.
- Product/story/help/delivery/contact and policy screens. WhatsApp/call actions
  appear after a confirmed support number is configured.
- Customer data rules, trusted owner claims, quote expiry, durable retries,
  stock validation, atomic order views and once-only cancellation stock returns.

Content and settings views are read-only. Delivery-rule editing, customer
management, media uploads, batch ledgers, automated courier booking, online/UPI
payments, refunds, feedback and push notifications are future work. Current
business photographs, support contacts and final policy/label facts must be
supplied rather than invented.

## Verify

```powershell
npm run typecheck
npm test
npm run build
npm run backend:test
npm run test:integration
npm audit --omit=dev
npm audit --omit=dev --prefix backend
```

In `apps/mobile`, run `flutter analyze` and `flutter test`.
The isolated integration suite uses Auth 9199 and RTDB 9100 and does not reset
the interactive database. GitHub Actions checks the web, backend and Android
source and uploads a standalone preview APK.
See the [verification report](docs/VERIFICATION-2026-10-20.md) for connected
client and persistence results, and the [APK reference](docs/APK-BUILDS.md)
for the local builds, installation paths and integrity hashes.

## Connect the live store

Both registered clients use project `narayananaturals-6b5aa`. Read-only checks
on 20 October 2026 confirmed an active Realtime Database, email/password Auth
enabled and Firebase billing disabled. No live store data, rules deployment,
public API or real order has been created by this implementation work.

Live operation needs a hosted HTTPS Node API, secure Admin credentials,
App Check, explicit CORS origins, deployed RTDB rules, an owner custom claim,
confirmed catalogue/stock/PIN rules and business policies, and release signing.
See [backend setup](docs/BACKEND-SETUP.md) for the exact procedure.

The initial Node API uses an atomic transaction over a bounded commerce ledger.
Its full-ledger downloads grow with store activity; it is suitable for an
initial small store and does not promise unlimited free operation. Orders and
completed retry receipts are retained. Capacity limits stop new operations
safely rather than deleting purchase history.

## Project references

- [Product scope](PRODUCT.md)
- [Implemented screen map](docs/SCREEN-MAP.md)
- [UX and visual direction](docs/UX-DESIGN-BRIEF.md)
- [System architecture](docs/FIREBASE-ARCHITECTURE.md)
- [Backend setup](docs/BACKEND-SETUP.md)
- [Commerce contract](contracts/v1/README.md)
- [Implementation and release work](docs/IMPLEMENTATION-PLAN.md)
