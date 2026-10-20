# Narayana Naturals

> **Development snapshot (20 October 2026).** The website is being moved to
> Firebase Realtime Database with email/password login and a separate Node API.
> The Android app, backend, setup commands and verification workflow below are
> being updated to the same architecture. This first push preserves the current
> source; it does not represent a deployed or fully verified selling store.

A bilingual Next.js storefront, Flutter Android customer app and Firebase
commerce backend for Narayana Naturals bull-driven wooden Ghani groundnut oil.
The website and app use the same customer identities, catalogue, cart,
addresses and orders. The web owner dashboard controls prices, available packs
and order status for both channels.

The implemented checkout uses **cash on delivery** for eligible PIN codes.
Online payment is unavailable until a merchant integration is configured.
The repository includes a working local preview and the source for connecting
to the owner's Firebase project; live deployment and merchant/courier setup
are separate release steps.

## Start the connected local preview

Requirements: Node.js 22, npm and Java 21 or later. The backend has its own
lockfile. From the repository root:

```powershell
Set-Location 'D:\Hackathons\Narayana Naturals'
npm ci
npm run backend:install
npm run backend:build
npm run emulators
```

Keep that terminal running. In another terminal in the same directory:

```powershell
npm run emulators:seed
Copy-Item apps/web/.env.example apps/web/.env.local
$env:NEXT_PUBLIC_BACKEND_MODE = 'emulator'
npm run dev
```

If `.env.local` already contains your web configuration, keep it and change
`NEXT_PUBLIC_BACKEND_MODE` to `emulator` rather than overwriting it. The
process environment in the example also selects emulator mode for that run.

Open [the storefront](http://localhost:3000),
[the owner dashboard](http://localhost:3000/admin), or
[the Firebase Emulator UI](http://127.0.0.1:4000).
The web server binds to the local machine at `127.0.0.1:3000`.

The seed command writes only to loopback emulators in project
`demo-narayana-naturals`. It refuses cloud projects and nonlocal hosts.
It sets illustrative catalogue/stock/rates and fixture accounts. Rerunning
the full seed resets those catalogue and stock values; use it deliberately.

### Try a complete order

1. In Shop oil, add a 1, 2 or 5 litre pack. Reload the cart to see guest
   persistence.
2. Continue to checkout and sign in. **Fill sample details** uses emulated
   customer phone `6000000001`. Request a verification code; no SMS is sent.
3. Find the six-digit code in the Auth Emulator UI/logs or its
   [verification-code endpoint](http://127.0.0.1:9099/emulator/v1/projects/demo-narayana-naturals/verificationCodes).
4. Use a sample address with Chittoor PIN `517001` or Tirupati `517501`.
   Review delivery and the full total, then place the preview COD order.
5. View the result and order history. A first-login welcome is deferred until
   checkout finishes; page help can be skipped, dismissed and replayed from
   Account.
6. In a separate browser, sign in with owner phone `6000000003`, using its
   generated emulator code. Open `/admin` and update the order through
   Received, Packed, Shipped and Delivered. The customer sees the status
   change without a new order being created.
7. Sign in with the same customer phone on another connected client to see
   the same cart, address and orders. Guidance has separate web/Android
   progress because their navigation differs.

The owner fixture is granted `admin:true` by trusted emulator setup. Ordinary
customer accounts cannot gain owner access by changing a profile or URL.
Phone `6000000002` is a second customer for testing account separation.

Courier sample PINs include `560001`, `500001`, `110001` and `600001`.
Their illustrative rates support preview COD orders. A rule with
`codAllowed:false` instead allows a delivery quote but prevents ordering
while online payment is unavailable. Real nationwide delivery requires
confirmed PIN/rate/COD rules for the chosen courier.

## Backend modes

| Mode | Data and behavior |
| --- | --- |
| `demo` | Device-local sample accounts, cart and COD orders; no Firebase requests. Website/app demo data do not synchronize. |
| `emulator` | Real Firebase SDKs and callables against shared local Auth, Firestore and Functions with labelled sample data. No real payment, SMS or delivery. |
| `firebase` | Registered production project, verified phone authentication and hosted callables. Missing setup produces a recoverable error. |

On the web select `NEXT_PUBLIC_BACKEND_MODE` before running or building.
Android uses a build-time `BACKEND_MODE` define; see
[Android setup](apps/mobile/README.md). Emulator mode forces the demo project
ID before SDK initialization, even when real client configuration is present.
A failed Firebase request never creates a demo order.

## Build and verify

```powershell
npm run typecheck
npm test
npm run build
npm run backend:test
```

For an isolated backend rules/integration run, first stop any existing
emulator suite on the same ports, then run:

```powershell
npm run test:integration
```

The integration suite clears the demo Firestore database per test. Reseed
afterward before browsing. See [backend setup](docs/BACKEND-SETUP.md) for
running tests against an existing suite and for the safety checks.

Android requires Flutter 3.41.6, its Android SDK and Java. From `apps/mobile`:

```powershell
flutter pub get --enforce-lockfile
flutter analyze
flutter test
flutter build apk --release --dart-define=BACKEND_MODE=demo
```

The generated APK is
`apps/mobile/build/app/outputs/flutter-apk/app-release.apk`. The default
internal build uses the Android debug signing key. Configure an owner-held
release keystore before public distribution; keystores and signing properties
are excluded from Git. A demo APK works without a server, while an emulator
APK requires the shared emulator suite and a reachable host.

[GitHub Actions](.github/workflows/verify.yml) checks web types/tests/build,
backend unit/rules/integration tests, production npm dependencies, and Flutter
analysis/tests, then uploads an internal demo APK artifact.

## Implementation and limits

Customer features include pack selection, quantities, OTP sign-in, a default
saved address, exact PIN serviceability, authoritative delivery quotes, COD
orders, order history/detail, repeat ordering, English/Telugu preferences and
optional first-login/page guidance. Authenticated data is scoped to the UID.
Orders are server-owned purchase snapshots; a quoted price or client total
cannot overwrite server prices or stock.

Checkout retains the original quote and retry key after an interrupted order
attempt. The backend verifies ownership, current terms and stock in a
transaction, preventing duplicate orders and overselling. Order confirmation
survives a separate cart-cleanup error.

The owner dashboard implements overview, order management, prices and packed
stock. Content/settings views expose the available configuration without
pretending every future management tool is implemented. Batch ledgers,
customer-support search, editable delivery rules/content, courier bookings,
online payments, notifications and customer feedback remain later work.

The supplied client registrations use Firebase project
`narayananaturals-6b5aa` and Android package `com.narayananaturals.app`.
Client API keys/app IDs identify the registered apps; they are not Admin SDK
credentials. Web `.env.local`, private keys, merchant secrets, generated
files and APKs are excluded from Git. The canonical Android
`google-services.json` contains public client configuration.

Before accepting live orders, configure Firestore, Phone Auth, App Check,
the appropriate Functions billing plan, deployed rules/indexes/functions and
an owner custom claim. Confirm prices, stock, PIN/rates/COD, support details
and policy/product facts. Production setup is documented in
[backend setup](docs/BACKEND-SETUP.md) and
[the web environment example](apps/web/.env.example).
The emulator seed refuses production and preview records cannot authorize
a live checkout.

₹450 / ₹900 / ₹2,250 for the three packs and all preview delivery charges
are illustrative. The supplied enhanced logo is used throughout; pack art
is labelled as a packaging concept. Actual product/Ghani photographs,
business/licence details and approved customer policies must come from the
owner. WhatsApp support is enabled only when a valid business number is
configured.

## Project references

| Document | Purpose |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Confirmed project goal and remaining business decisions |
| [Screen map](docs/SCREEN-MAP.md) | Website, Android and owner page types and reusable states |
| [Design system](DESIGN.md) | Shared palette, typography and interface behavior |
| [UX brief](docs/UX-DESIGN-BRIEF.md) | Navigation, bilingual forms and first-login guidance |
| [Commerce contract v1](contracts/v1/README.md) | Exact paths, payloads, money units, transitions and errors |
| [Backend setup](docs/BACKEND-SETUP.md) | Emulator tutorial, rules, App Check and live setup |
| [Firebase architecture](docs/FIREBASE-ARCHITECTURE.md) | Implemented v1 and future system design |
| [Implementation plan](docs/IMPLEMENTATION-PLAN.md) | Acceptance criteria and release dependencies |
| [Brand assets](design/brand/README.md) | Original logo, enhanced SVG/PNG and brand files |
