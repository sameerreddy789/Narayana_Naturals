# Shared Firebase backend

The website and Android app share Firebase Auth identities, Firestore documents and the four TypeScript second-generation callable Functions in `asia-south1`. The wire contract is [contracts/v1/README.md](../contracts/v1/README.md), with machine-readable requests and responses in [schema.json](../contracts/v1/schema.json). No real Firebase services, billing, SMS or payment merchant account are provisioned by this repository.

## Local requirements and commands

Use Node.js 22, npm, the repository's Firebase CLI dependency and Java 21 for the current Firestore emulator. The backend keeps a separate lockfile; install its dependencies independently of the web workspace:

Dependencies use Firebase Admin 14.5, Functions 7.4 and Firebase client 12.19/rules-unit-testing 5 for Node 22. Compatible App/App-compat versions are pinned because the next patch releases require Node 24.12; gRPC 1.14.6 overrides an older pinned SDK dependency to resolve its published advisory. Keep those constraints in mind when updating the lockfile.

```powershell
npm --prefix functions ci --workspaces=false
npm --prefix functions run build
npm --prefix functions test
```

Start all required emulators from the repository root in a separate terminal:

```powershell
npx firebase emulators:start --project demo-narayana-naturals --only auth,firestore,functions
```

The default `.firebaserc` selects the **demo** project. Auth is on port 9099, Firestore 8080, Functions 5001 and the Emulator UI 4000. Use `http://127.0.0.1:4000` to inspect local data. Configure clients to use the same `demo-narayana-naturals` project ID; mixing a real project ID with demo emulator data creates a separate namespace.

Seed the running emulators, then run the integration suite:

```powershell
$env:GCLOUD_PROJECT = 'demo-narayana-naturals'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
npm --prefix functions run seed:emulator
npm --prefix functions run test:integration
```

Alternatively, Firebase's `emulators:exec` starts, supplies emulator environment variables and stops the services around one test run:

```powershell
npx firebase emulators:exec --project demo-narayana-naturals --only auth,firestore,functions "npm --prefix functions run test:integration"
```

Integration tests clear the demo Firestore database before each case. Rerun the seed afterward when browsing the app. Tests refuse missing emulator hosts, hosts outside loopback or a project ID other than the demo project. The seed entry point, `functions/lib/scripts/seed-emulator.js`, applies the same checks before initializing Firebase Admin. It requires **both** Firestore and Auth emulator variables; setting a Firebase project alone cannot seed anything.

## Preview fixtures

All seeded products, variants, packed inventory and delivery rules carry `preview:true`; the storefront and every emulator order also display preview status. Server checkout rejects a preview marker in **any** source outside the Functions emulator, even if `orderingEnabled` was changed or the storefront's preview flag was cleared. `updateVariant` preserves fixture markers.

The illustrative pack prices are ₹450 / ₹900 / ₹2,250 for 1 / 2 / 5 litres, stored as 45,000 / 90,000 / 225,000 paise. Available packed counts are 12 / 8 / 4. Chittoor 517001 and Tirupati 517501 represent the user's local areas with preview delivery rules; PIN 523201 remains an additional local test fixture. PINs 500001, 110001, 560001 and 600001 illustrate courier delivery. Fees/estimates and actual business/courier eligibility require confirmation before sale. Sample courier fees are ₹120 plus ₹25 per litre above two included litres. No sample support number, certification, shipping guarantee or payment merchant credential is supplied.

To append only the two Chittoor/Tirupati preview rules to an already running demo without resetting stock, build and run `node functions/lib/scripts/seed-emulator.js --additional-local-pins` with the same guarded emulator environment variables.

The Auth emulator has these fixture users:

| Role | UID | Emulated phone |
| --- | --- | --- |
| Customer | `preview-customer` | `+916000000001` |
| Other customer | `preview-other` | `+916000000002` |
| Owner | `preview-owner` | `+916000000003` |

Only the emulated owner has the custom claim `{admin:true}`. Use the phone verification code shown by the Auth Emulator UI/terminal. No real SMS is sent by an emulator. A token issued before a claim change must be refreshed before the dashboard sees the new claim.

## Client connection and App Check

Initialize Auth, Firestore and Functions once. Select `asia-south1` when obtaining the Functions instance, then connect each SDK to its emulator before the first request. Website clients use localhost/127.0.0.1. An Android emulator reaches the development machine through `10.0.2.2`; a physical device needs the machine's LAN host with an intentional emulator bind/firewall setup. Keep the client project ID set to the demo project for these development connections.

Callables require Firebase Auth. Checkout accepts the **verified Auth token** `phone_number` only when it matches `+91` followed by a valid ten-digit Indian mobile number. Customer profile data cannot substitute for verification. The delivery address may contain another valid recipient mobile number. Administrative callables require a boolean Auth custom claim `admin:true`; a customer profile field, UI route or client toggle cannot confer that privilege.

App Check is enforced by all four callables outside the Functions emulator. The bypass requires `FUNCTIONS_EMULATOR=true` **and** the Firestore emulator host in the server runtime. Do not set those runtime flags on a hosted service. Production clients must initialize an App Check provider before their first callable request:

- Web: register the actual web app and domains and configure reCAPTCHA Enterprise (or another supported production provider).
- Android: register the actual package, signing certificate fingerprints and Play Integrity provider. Use a registered debug provider token only for controlled development.
- Firebase Auth: enable Phone sign-in, authorize the real web domains and configure India SMS region policy, app verification and the Android signing fingerprints as required by Firebase.

Firebase client configuration/API keys identify an app and are not Admin credentials. Service account private keys and merchant secrets must never be included in a client bundle or source control. The repository supplies no App Check production site key or debug token.

## Server behavior

`quoteCheckout` validates exact request fields, one to three unique pack IDs, integer quantities from 1 to 20, a Unicode address and the channel. It reads the published product, enabled packs, private available stock, ready storefront and exact enabled PIN rule. A quote lasts ten minutes and belongs to the requesting UID. Quotes do not reserve stock. Shipping is `feePaise + max(0, litres - includedLitres) * extraLitrePaise`; omitted surcharge fields mean zero. Prices and totals are always integer paise with safe upper bounds.

`placeCodOrder` uses a stable client-generated retry key of 8–128 allowed characters. Persist that key for network retries rather than generating a new key every time. The server transaction reads the quote, retry record, current product/prices/delivery terms and packed inventory before writing anything. It verifies ownership and expiry, compares the quoted terms, deducts stock, updates public stock, snapshots the purchase facts, records the retry key and consumes the quote atomically. Competing requests for the last pack cannot both succeed. A stock change with enough remaining packs leaves the price quote valid; a price/delivery change requires a fresh visible quote. A disabled delivery PIN on an existing quote returns `QUOTE_CHANGED`.

The same quote can create only one order, even with different retry keys. A key already used for another quote returns `IDEMPOTENCY_CONFLICT`. Completed retries return the original order after quote expiry and bypass the new-order rate limit. Quotes are limited to ten requests per UID per minute; new order attempts to twenty. All internal quote, retry, rate and inventory records are inaccessible to client SDKs.

Creating an order does not clear `carts/{uid}`. After the server returns `orderId`, the client transactionally removes only purchased lines whose quantities still match the reviewed snapshot, preserving later edits and unrelated packs. It stores the resulting lines with `updatedAt:serverTimestamp()` and updates its local cart. Keep the successful order result even if cart synchronization fails; a cart cleanup error must not trigger a new purchase or replace the existing retry key.

`updateVariant` atomically sets the current pack price, available packed count and enabled state in both authoritative inventory and public catalogue. Treat `stock` as the absolute count of **currently available packs**, excluding packs already allocated to active orders. It is not an adjustment or a litre count.

`updateOrderStatus` allows `received → packed → shipped → delivered`. Only `received` and `packed` may move to `cancelled`. Cancellation restores packs once; repeating the same status is idempotent. Shipped and delivered orders cannot be cancelled by this function. COD payment state becomes `collected` on delivery or `cancelled` on cancellation. Status edits preserve the original phone, address, prices, order lines and creation time. Returns/refunds need a future explicit workflow.

Only cash on delivery is implemented. There is no online payment endpoint or fabricated payment-success status. Missing store settings disable checkout. The ready storefront configuration requires `onlinePaymentsEnabled:false` until a reviewed merchant integration replaces that contract.

## Firestore and storage access

Guests read published catalogue documents, variants beneath a published product, `publicContent/storefront`, and individual enabled six-digit delivery rules. Delivery rule collection listing is denied. Query products with `where('published','==',true)`; rules do not filter an unrestricted query for the client.

Authenticated customers read and write only their own exact profile, default address, cart and `web-v1`/`android-v1` onboarding records. Profiles accept only display name, verified phone and English/Telugu language. Carts accept only pack IDs/quantities and a Firestore `serverTimestamp()` for `updatedAt`; prices, totals and duplicate entries are denied. Onboarding accepts booleans and at most twenty distinct page IDs of up to 64 characters.

Order documents are readable by their UID owner or an `admin:true` claimant, and all direct client writes are denied—including writes from an owner dashboard. Customer list queries must include `where('uid','==',currentUser.uid)`, `orderBy('createdAt','desc')` and a limit of at most 100. Owner lists use `orderBy('createdAt','desc')` and a limit of at most 100. The required UID/creation-time composite index is supplied in `firebase/firestore.indexes.json`. Use trusted Admin tooling for initial product copy, delivery policies and storefront configuration; these have no client write path in v1.

Unknown Firestore paths deny all client access. Storage currently denies all access; no user-upload or public storage-photo feature is configured. Admin SDK access bypasses rules, so the callable service independently validates permissions and commercial invariants.

## Preparing an actual store

The local build is ready for emulator development. The owner-supplied web and Android apps are registered to `narayananaturals-6b5aa`, and Firebase CLI authorization with `narayananaturals@gmail.com` is verified. Read-only checks on 20 October 2026 found no Firestore database, billing disabled and Phone Auth disabled. `localhost` and the project's Firebase Hosting domains are authorized; no test phone numbers are configured. Functions/App Check deployment readiness has not been established.

Use `--account narayananaturals@gmail.com` for this project's live CLI commands; do not change unrelated global account preferences. A real release still needs Firestore provisioning, Phone Auth with India SMS settings, the applicable Functions billing plan, signed Android release configuration, App Check providers, deployed rules/indexes/functions, approved product/label/policy data, final prices and tax/invoice treatment, an accurate available-pack count, confirmed delivery PINs/rates/COD eligibility, and an operational support contact. Create real records without fixture markers through trusted setup tooling and deliberately enable the storefront only after those records are reviewed. The fixture seed cannot create production records.

Second-generation hosted Functions require the applicable Firebase plan and Google Cloud services. Billing, deployment and any resulting live SMS or order traffic are separate release actions; none have been performed here. No courier or online merchant integration is configured. Decide the operational retention policy for orders/quote PII before live use; retry keys currently remain durable to guarantee stable completed retries. A retention process must preserve the consumed-quote/retry invariants.

## Verification and references

The backend has contract/validation/math unit tests, emulator rules tests with authenticated and unauthenticated clients, and transaction/integration tests against the actual Firestore/Auth/Functions emulators. Integration coverage includes native callable error transport, shared web/Android identities, malformed inputs, foreign and expired quotes, changed delivery/prices, reused retry keys, duplicate concurrent submissions, last-pack contention, immutable purchase snapshots, admin claims, cancellation retries, fulfillment transitions, preview guards and rate limits. The tests do not send real SMS or invoke production APIs.

Verified on 20 October 2026: TypeScript build passed; 14/14 unit tests and 28/28 emulator tests (18 integration, 10 rules) passed with zero failures or skips. The emulator suite took 54.237 seconds including callable cold starts. The independent backend dependency audit reported zero vulnerabilities. Clean preview data was restored after tests.

Official sources checked through the Agent Reach web reader on 20 October 2026:

- [Firebase transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions): all reads precede writes; transaction callbacks may retry on concurrent edits; writes commit atomically.
- [App Check enforcement for callable Functions](https://firebase.google.com/docs/app-check/cloud-functions): second-generation `onCall` supports `enforceAppCheck:true`.
- [Security Rules emulator unit tests](https://firebase.google.com/docs/rules/unit-tests): authenticated/unauthenticated contexts, rules-disabled fixtures and `initializeTestEnvironment`.
- [Callable Functions protocol](https://firebase.google.com/docs/functions/callable-reference): Firebase Auth and callable error/result transport.
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite/connect_and_prototype): use a consistent demo project ID and connect each client SDK explicitly.
