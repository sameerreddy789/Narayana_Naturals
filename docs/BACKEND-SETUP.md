# Backend setup

The website and Android app use Firebase email/password Authentication,
Realtime Database and the TypeScript Node API in `backend/`.
The [commerce contract](../contracts/v1/README.md) defines the four API
operations. No Firestore, SMS login or Cloud Functions deployment is required.

## Local installation

Use Node.js 22, npm and Java 21 or later. The API has a separate lockfile:

```powershell
npm ci
npm run backend:install
npm run backend:build
npm run backend:test
```

Start the shared Auth and RTDB emulators with `npm run emulators`.
Ports are Auth 9099, RTDB 9000 and Emulator UI 4000.
The launcher restores a previous normal-shutdown export from
`.local-run/rtdb-emulator-data` when present.
Before stopping services, run `npm run emulators:save` from another terminal
and wait for success. Then use Ctrl+C in the emulator terminal and wait for
shutdown. Forced process termination can bypass the automatic export.

In another root terminal, run `npm run emulators:seed` once for fixture
setup, then `npm run backend:start`. The API binds to `127.0.0.1:5002`.
Default API configuration is safe local emulator mode. Optional
`backend/.env` overrides are loaded by the root start command;
`backend/.env.example` documents the fields.

In a third terminal, set `NEXT_PUBLIC_BACKEND_MODE=emulator` and run
`npm run dev`. The website and Android emulator use the same demo project.
An Android emulator reaches the host with `10.0.2.2`; a USB device requires
a `127.0.0.1` host build and reverse forwarding of 9099, 9000 and 5002.

## Fixtures and tests

The seed only works with project `demo-narayana-naturals` and both
loopback emulator hosts. It cannot initialize production data.
Sample accounts are `customer@narayana.test`, `other@narayana.test`
and `owner@narayana.test`, password `NarayanaDemo123!`.
The owner fixture has a trusted `admin:true` Auth claim.

Sample prices are ₹450/₹900/₹2,250 for 1/2/5 L. Local example PINs
`517001`, `517501`, `523201` use free sample delivery. Courier examples
`500001`, `110001`, `560001`, `600001` use ₹120 plus ₹25 per litre
above two included litres. Every fixture/order is labelled preview.
Production ordering rejects preview-marked terms.

```powershell
npm run test:integration
```

This starts isolated Auth 9199, RTDB 9100, hub 4700 and logging 4800.
Tests refuse the interactive ports before resetting their own fixture data.
Coverage includes real Auth tokens and HTTP transport, authorization,
concurrent last-pack purchases/retries, restart recovery, quote ownership,
changed terms, once-only cancellation, capacity rollback and RTDB client rules.

## Live configuration

Read-only checks on 20 October 2026 verified:

| Setting | State |
| --- | --- |
| Firebase project | `narayananaturals-6b5aa` |
| Project owner CLI account | `narayananaturals@gmail.com` |
| RTDB | Active, `us-central1` |
| RTDB URL | `https://narayananaturals-6b5aa-default-rtdb.firebaseio.com` |
| Email/password Authentication | Enabled |
| Phone Authentication | Disabled |
| Firebase billing | Disabled |
| Public API/website deployment | Not configured by this work |

Use `--account narayananaturals@gmail.com` for live Firebase CLI actions.
Preserve unrelated global account preferences.

The API needs a Node host with HTTPS, network access to Firebase and
secure Application Default Credentials. Prefer the hosting environment's
service identity. If a service-account file is necessary, keep it outside
source control and supply `GOOGLE_APPLICATION_CREDENTIALS` on the server.
Public web/Android Firebase configuration is not an Admin credential.

Configure the server environment:

```dotenv
BACKEND_MODE=firebase
GCLOUD_PROJECT=narayananaturals-6b5aa
DATABASE_URL=https://narayananaturals-6b5aa-default-rtdb.firebaseio.com
HOST=0.0.0.0
PORT=5002
ALLOWED_ORIGINS=https://your-confirmed-store-domain
```

Remove both emulator host variables for live mode. Put the HTTP Node service
behind TLS or use a hosting platform's HTTPS proxy. Replace the example origin
with the actual website origin. CORS is an explicit allowlist, not a wildcard.
Hosting costs and free-host restrictions are independent of Firebase billing.

## Rules, owner access and App Check

The prepared rules file is `firebase/database.rules.json`.
Deploy it deliberately after choosing the live environment:

```powershell
npx firebase deploy --only database --project narayananaturals-6b5aa --account narayananaturals@gmail.com
```

Personal paths are scoped to the customer's UID. Profiles keep the Auth
email, name and language; the optional phone is a delivery contact.
Carts only contain valid pack IDs, unique quantities and a server time.
Orders, prices, stock, quotes and receipts are server-only writes.
Only an owner claim can read the owner order index.

Create an email/password owner Auth account. In trusted Admin tooling,
retrieve that user's existing custom claims and add `admin:true`.
Refresh its sign-in token afterward. Editable profile fields cannot grant
owner access. Do not place service credentials in either frontend.

Register web App Check (reCAPTCHA v3) and Android App Check (Play Integrity)
in the Firebase console. The live API always verifies App Check.
Registered debug providers are for internal staging only.

For the website set `NEXT_PUBLIC_BACKEND_MODE=firebase`, public web Firebase
fields, `NEXT_PUBLIC_COMMERCE_API_URL` to the hosted HTTPS API and
`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`. Rebuild/restart after changing
public variables. Keep the web and Android API keys/app IDs distinct.

For Android set `BACKEND_MODE=firebase`, `COMMERCE_API_URL`,
`APP_CHECK_PROVIDER=playIntegrity` and `INTERNAL_BUILD=false`.
Configure owner release signing before public distribution.

## Publish actual store data

Use trusted server/console tooling to supply the paths in the
[architecture reference](FIREBASE-ARCHITECTURE.md): published product facts,
current prices and packed stock, exact eligible delivery PINs and rates,
support contact and storefront settings. Set `preview:false` on real records.
Keep ordering disabled until business inputs, rules and API behavior have
been reviewed. The demo fixture command is not a production seed.

The owner must confirm food/label/storage facts, product/process photographs,
actual selling prices and tax/invoice treatment, parcel/courier acceptance,
COD coverage, dispatch estimates and customer policies.

## Operation and limits

`GET /health` checks database connectivity and whether storefront
configuration exists. `status:ok` does not prove ordering is enabled,
stock is present or business inputs are valid.

The initial API uses a transaction over the entire commerce ledger.
It caps 500 orders, 2,000 durable receipts, 750 quotes, 1,000 limit records
and 4 MiB of JSON. Full-ledger downloads increase with activity.
Monitor RTDB usage and hosting limits; avoiding Firebase billing does not
provide unlimited throughput. Capacity errors preserve historical orders
and completed retry receipts.

Retain backups and adopt a PII retention/deletion policy before live sales.
An archive/scale change must preserve quote/receipt deduplication.
The current version has no automated merchant payments, courier booking,
notification worker, feedback, invoice generation or refund processing.
