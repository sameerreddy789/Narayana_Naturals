# Implementation plan

## Current checkpoint — 20 October 2026

The shared v1 contract and Firebase backend are implemented and verified:
14 unit tests and 28 Auth/Firestore/Functions emulator tests passed. The
Next.js storefront is connected with phone authentication, UID-scoped
cart/address/order/guidance data, authoritative COD quotes and owner controls.
Flutter implements the same contract with native customer screens.
The repository has reproducible build/test commands and CI.

Online payments, courier booking, advanced owner tools and hosted activation
remain release work. The phases below describe the broader target and are
not a claim that every payment, notification or inventory-ledger feature is
already present. Use [README.md](../README.md) and
[commerce contract v1](../contracts/v1/README.md) for current behavior.

Status: production milestone plan for the confirmed Next.js / Flutter / Firebase stack. The Next.js website, native Flutter client and shared Firebase emulator backend are implemented. Hosted Firebase provisioning and real payment/courier integrations remain release dependencies.

## Implemented local preview

The connected local website implements catalogue, packs, cart, emulator phone sign-in, server-quoted address/PIN delivery, COD checkout, order history and reorder, bilingual controls, and the first-login welcome with per-page tips, skip and replay. The owner dashboard implements overview, orders/status updates, and catalogue/inventory editing. Online payments are unavailable.

Emulator mode uses real Firebase SDKs and trusted Functions for shared data, pricing/stock checks and owner authorization. Standalone demo mode instead uses device-local sample data and does not synchronize between clients. Neither mode accepts real payment or fulfillment; hosted Firebase configuration, business inputs and release signing remain prerequisites for public sale. See [README.md](../README.md) for local run instructions and implemented coverage.

## Proposed repository boundaries

```text
apps/
  web/                 Next.js customer pages and /admin dashboard
  mobile/              Flutter customer app
functions/             TypeScript trusted Firebase backend
contracts/             Versioned JSON schemas and shared API fixtures
design/                Platform-neutral token definitions and asset references
content/               Shared English/Telugu content and guide definitions
firebase/              Rules, indexes, emulator and deployment configuration
docs/                  Product, screens, UX, architecture and delivery plan
```

The TypeScript and Flutter projects have separate toolchains. Common contracts and server rules prevent commercial logic drifting between them. Native navigation/components remain platform-specific.

## Build sequence

| Milestone | Deliverable | Completion evidence |
| --- | --- | --- |
| 1. Shared foundation | Contracts, explicit status/money units, Firebase emulator setup, Auth/profile/address/cart model, and rules. | Web and Flutter contract fixtures agree; private records and privileged writes enforce the expected ownership. |
| 2. Key UX and design system | Real-asset-aware Home, Product, Checkout, Orders, Account, owner order detail, and first-login tour designs; English/Telugu and responsive/native states. | Reviewable key layouts, approved direction, clear total/CTA hierarchy, and accessible tour skip/replay. |
| 3. Website ordering slice | Catalogue/variants, cart, phone sign-in, address/PIN quoting, test COD order, order history/result, owner orders and stock controls. | A complete emulator/staging order changes stock once and appears in the owner dashboard. |
| 4. Payments and nationwide fulfillment | Gateway test integration, verification/webhooks, reservations/expiry, refund exceptions, actual delivery rules/provider adapter and package-rate inputs. | Test captured/pending/failed/late payments, eligible/ineligible PINs, correct charges, and reconciliation. |
| 5. Flutter customer flow | Equivalent customer buying/order flows using FlutterFire and the same function contracts; native navigation, shared accounts/cart/guide state. | A web order appears in Flutter and an app order appears on the website/owner dashboard for the same customer. |
| 6. Complete pages and operations | Remaining story/help/policy pages, admin content/delivery/customer/settings screens, private receipts, opted-in notifications, feedback and reorder. | All scoped destinations work in both languages; owner changes reach both channels; guide introductions cover the page registry. |
| 7. Release verification | Meaningful rules/function tests, key web/mobile end-to-end scenarios, real Android/device checks, accessibility and poor-network checks. | The acceptance criteria below pass in staging; unresolved issues and actual device coverage are recorded. |
| 8. Launch | Business facts, packaging/courier checks, live provider setup, domain/app distribution, monitored first real orders. | Live payment/dispatch setup is verified, customer policies match operations, and the owner can run daily fulfillment. |

Milestones express dependencies, not a promised number of days. Payment/courier onboarding, business assets, and any iOS release requirements can affect the schedule. The website ordering slice proves the common commerce flow; the Flutter app is part of the agreed release scope.

## First-login guide implementation

- Use one content registry keyed by customer page ID, surface, language, and guide version.
- Website guidance targets stable semantic anchors and supplies inline fallbacks; Flutter uses its own native anchors and navigation model.
- Welcome is nonmandatory. First-login progress is stored by UID, with skipped/completed state and explicit replay.
- Test a first login from Home and from Checkout, a skipped guide, reload/relaunch, another device, a language change mid-guide, missing targets, keyboard/screen-reader use, and large text.
- Tour interactions only explain the UI. They never mutate a cart/order or trigger payment.

## Acceptance criteria that matter

1. A customer buys on the website, signs into the app with the same account, and sees the same order, address, preferences, and permitted cart state. Each channel can create orders visible to the owner.
2. An owner changes a price/variant availability/delivery rule; both clients receive the update. A stale client or modified request cannot purchase using its own forged total or invalid delivery rule.
3. Competing checkouts for the last packs cannot drive available stock below zero. Repeated submit/webhook/worker calls cannot create duplicate orders or duplicate stock movements.
4. Online orders finalize only after verified captured funds and successful allocation. COD remains due until collection is recorded. Late payment, cancellation, and refund outcomes are visible and reconciled.
5. Local and courier orders show the real complete total before placement. Ineligible PINs, missing rates, and unsupported COD produce clear recoverable states.
6. Cross-account order/address reads and unauthorized owner functions are denied. Public server-rendered pages exclude drafts and private business data.
7. All customer screens, essential policies, errors, and guided-tour steps work in English and Telugu. Language switching preserves shopping context.
8. A first-time customer can skip page guidance and replay it later. Skipped/completed guidance stays remembered and does not disrupt OTP/payment.
9. Empty, offline, loading, failed-payment, delayed-confirmation, changed-price, and out-of-stock states preserve useful work and provide a clear next action.
10. Website keyboard/focus behavior and mobile touch/system-back/text scaling work on the tested devices. Native screenshots come from actual emulator/device builds rather than web mockups.

Tests belong at shared contracts, permissions, stock/payment transitions, and critical shopping flows. Static text/color changes need a bounded visual review rather than tests that merely repeat their implementation.

## Business inputs before live ordering

The blueprint can be implemented and tested with clearly labeled sample catalogue data and provider test mode. Production needs:

- Final sale prices/MRP, tax/invoice treatment, product/label/storage/shelf-life facts, and real packed stock.
- Logo, actual product/production images, support number/hours, and supplied business/licence information.
- Dispatch origin, local coverage, fees and COD limits; courier acceptance of the actual oil packaging, verified PIN/rate data, packed weights/dimensions, and delivery ranges.
- Payment merchant/provider activation and secure live credentials; shipping account/provider details.
- Approved shipping, cancellation, damaged-parcel, returns/refunds, privacy, and terms content in both languages.
- App launch platforms, current build/operating budget, domain, and distribution-account requirements.

Nationwide shipping does not mean every PIN code is automatically eligible. Live checkout must use the confirmed serviceability rules.

## Initial daily owner workflow

Review new orders and payment exceptions → confirm eligible orders → allocate/pack the appropriate batch → dispatch locally or with the courier → publish tracking/status → reconcile delivery/COD/refunds → review stock and repeat orders.

The owner dashboard must support this workflow before the store accepts live orders.
