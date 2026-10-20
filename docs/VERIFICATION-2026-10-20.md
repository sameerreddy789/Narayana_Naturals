# Verification and release readiness

Verified on 20 October 2026. The connected local store uses the Next.js
website, Flutter Android app, Firebase email/password Authentication,
Realtime Database and the Node commerce API. Local orders are labelled
preview and do not collect payment or arrange deliveries.

## Automated checks

| Check | Result |
| --- | --- |
| Website TypeScript check | Passed |
| Website tests | 20 passed, no failures or skips |
| Next.js production build | Passed |
| Backend unit tests | 14 passed |
| Isolated Auth/RTDB integration and rule tests | 31 passed, no failures or skips |
| Flutter analysis | No issues |
| Flutter tests | 22 passed |
| Four internal release APK builds | Passed |
| Android APK signatures | Verified |
| Production dependency audits for website and API | No reported vulnerabilities |
| Git whitespace and private-key/token pattern checks | Passed |

The integration suite includes simultaneous last-pack purchases, concurrent
retries, restart recovery of completed orders, quote ownership/expiry,
changed terms, permitted fulfillment transitions, cancellation restoration,
capacity rollback and denial of customer access to owner operations.
Flutter tests cover cart/account isolation, checkout recovery, guidance,
narrow Telugu screens, large text, dark theme and back navigation.

## Connected client verification

Testing used an Android API 34 emulator and separate customer/owner browser
sessions against the same local Auth/RTDB project and API.

1. A fresh website registration saved the Auth account and RTDB profile and
   displayed the first-login welcome.
2. The Android customer signed in using the same fixture account as the
   website. Its native first-login welcome and page tips appeared.
3. Android loaded a website-saved cart containing one 2 L pack at ₹900 and
   the saved default address. It also displayed the earlier website order.
4. Android reviewed the server total and placed a preview COD order for ₹900.
   The owner website displayed that same ID, amount, address and Android channel.
5. The owner changed Received to Packed. Android updated its open order
   details, and the customer website showed Packed in the shared order history.
6. Purchased cart contents cleared after confirmation. Customer and owner
   order copies matched in Realtime Database.

The UI verification order IDs were
`dfdb3d8c-dd40-47b7-b4b7-a31b3ca49c79` (website) and
`6c853eaa-91c4-42e0-b163-5a416cc51241` (Android).
Screenshots and the native verification record are saved locally under the
ignored `artifacts/` directory. Test identities use the reserved `.test` domain.

The native test exposed an initial connection-listener event that could be
false after a successful database read. The Android backend now waits for
a confirmed connection when hydrating an account. Final Flutter checks and
all APK builds include that correction.

## Local state preservation

The initial emulator process termination bypassed its automatic export.
Local QA data was recreated through the local Auth and commerce APIs before
testing the final save/import workflow. Those API fixtures have separate IDs
from the UI verification above.

`npm run emulators:save` exported accounts and Realtime Database data.
The launcher restored that export after the services restarted. Checks
confirmed matching account identities/claims and an identical canonical
database SHA-256 digest:

```text
a4fa9554d5b4473128d21d58f54c91803b315ad579df68f9f097218342b5dc00
```

The restored fixture orders are
`53ac0099-e4f9-4707-ac5f-8d5df857fcb0` (website channel, ₹450, Received) and
`7eac46da-29e6-4442-966b-b71435473288` (Android channel, ₹900, Packed).
Both customer and owner copies, address, cart and stock survived the restart.
The local `artifacts/realtime-sync-verification.json` records the results.

Before ending a session, run the explicit save command and wait for export
success. Then stop the emulator normally. Forced process termination can
bypass its automatic export.

## Build outputs and scope

The [APK build reference](APK-BUILDS.md) identifies all four local outputs,
their intended connections and hashes. They are internal debug-key-signed
release builds for Android 7.0 or later, package `com.narayananaturals.app`,
version `1.0.0+1`. Physical-phone behavior and Play distribution require
separate device/release checks.

The [screen map](SCREEN-MAP.md) describes 19 customer website page types,
15 Android screen types plus welcome, and seven working owner destinations.
Owner content and settings views are read-only. Delivery/customer management,
merchant payments, courier booking, notifications, refunds, feedback and
advanced inventory are future integrations.

## Live Firebase status

Read-only checks confirmed project `narayananaturals-6b5aa`, active Realtime
Database, email/password Auth enabled, Phone Auth disabled and billing
disabled. The live database remains empty. No live rules deployment,
public website/API hosting or real order was performed by this work.

Live checkout needs the hosted HTTPS Node API and its Admin credentials,
App Check, explicit CORS, deployed RTDB rules, a trusted owner claim,
confirmed product/stock/PIN data and policies, and owner Android signing.
The Firebase-configured internal APK has no public API URL and leaves
App Check off; it displays setup errors where those services are required.
Use [backend setup](BACKEND-SETUP.md) to complete the live environment.
