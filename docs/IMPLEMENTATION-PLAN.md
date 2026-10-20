# Implementation and release plan

Updated 20 October 2026. The project uses Next.js, Flutter, Firebase
Realtime Database, email/password Auth and a Node commerce API.
Current behavior is defined by the [commerce contract](../contracts/v1/README.md).

## Implemented

The website and native app implement product/pack selection, cart, email
accounts, a default address, PIN eligibility, server quotes, COD orders,
history/status/reorder, English/Telugu and first-login/page guidance.
The owner website edits pack prices/stock/availability and order status.
Realtime listeners connect the two customer channels.

The backend has unit, isolated Auth/RTDB integration and database-rule tests.
Build commands and GitHub checks cover both frontends and the Node service.
Internal standalone, emulator and Firebase-configured APKs are provided;
public release signing is separate.

## Repository boundaries

```text
apps/web/       Next.js customer website and owner dashboard
apps/mobile/    Flutter Android customer app
backend/        TypeScript Node commerce API and emulator fixtures/tests
contracts/v1/   JSON wire schema and shared commerce reference
firebase/       Realtime Database rules
scripts/        Local emulator launcher
design/         Shared brand assets and design references
docs/           Setup, architecture, screens and release guidance
```

## Completion evidence

- Validate real Firebase SDK sign-in, account profile hydration and cart writes.
- Create website and app COD orders using the shared local backend.
- Verify customer order/address/cart synchronization and owner status changes.
- Check last-pack contention, concurrent retries, backend restart recovery,
  cancellation stock restoration and customer privilege denial.
- Build each Android mode and preserve its output before the next build.
- Run web typecheck/tests/build, Flutter analysis/tests and backend checks.
- Push the final source and verify GitHub Actions.

Local test evidence does not activate the public store or prove courier
fulfillment. Production account sign-in is separate from emulator accounts.

## Before public sale

1. Choose a domain and hosting for the Next.js site and HTTPS Node API.
   Keep Admin credentials in the hosting secret store.
2. Deploy RTDB rules, configure web/native App Check and API CORS, and
   provision the trusted owner account claim.
3. Publish confirmed prices, label/ingredient/storage facts and actual packed
   stock. Add real product/process photos and the operational support contact.
4. Confirm exact local and courier PINs, packaging acceptance, rates,
   COD eligibility, dispatch times and the returns/privacy/terms content.
5. Configure owner Android signing/distribution and perform live staging
   verification before deliberately enabling ordering.
6. Set operational backups, data retention, quota monitoring and a capacity
   upgrade plan for the bounded commerce ledger.

Nationwide shipping is a business requirement, represented by exact eligible
PIN rules. Every Indian PIN is not enabled automatically.

## Later product work

Merchant UPI/online payments and verified webhooks; courier booking/tracking;
notifications; feedback; customer cancellation/returns; richer delivery/content
editing; batch inventory/audit records; and optional iOS distribution.
These need separate implementation and operating decisions.
