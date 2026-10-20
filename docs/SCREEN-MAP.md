# Screen map — proposed first release

Status: target release scope updated 20 October 2026. Includes the user's first-login onboarding requirement. These counts describe page/screen types; current implementation coverage and release limits are recorded in [README.md](../README.md).

## Counting convention

| Surface | Count | Meaning |
| --- | ---: | --- |
| Customer website | 19 | Named page types before locale prefixes and individual order IDs |
| Flutter customer app | 15 | Primary screen types; policy documents share one viewer |
| Owner web dashboard | 10 | Sign-in plus nine management screens |

These are scope counts, not the number of independent visual designs. Shared layouts, components, content renderers, and document viewers reduce design and implementation work.

English/Telugu versions, the three pack sizes, individual order records, modals, guided tours, loading, and error states do not add page types. The implemented website preserves the same route when changing language; the registered preference selects translated UI. A future SEO localization pass may introduce locale-specific routes.

## Customer website — 19 page types

| ID | Page | Base route | Main job / first-visit guidance |
| --- | --- | --- | --- |
| W01 | Home | `/` | Explain the oil and actual Ghani process; show where to shop and change language. |
| W02 | Shop oil | `/shop` | Compare the available pack sizes; point to pack prices and availability. |
| W03 | Product detail | `/oil/groundnut` | Choose 1 / 2 / 5 L, quantity, check delivery, and add to cart; explain pack selection. |
| W04 | Our Ghani / about | `/our-ghani` | Show the business and process using real evidence; introduce the process sections. |
| W05 | Delivery | `/delivery` | Check eligible PIN codes and understand local/courier rules and charges. |
| W06 | FAQ | `/faq` | Answer product, storage, payment, order, and delivery questions. |
| W07 | Contact | `/contact` | Find WhatsApp, phone, support hours, and supplied business contact details. |
| W08 | Cart | `/cart` | Change quantities and see the current estimate; point to delivery calculation at checkout. |
| W09 | Checkout | `/checkout` | Verify phone, enter address, check PIN, choose payment, and review the full payable total. |
| W10 | Order result | `/order-result/[sessionId]` | Show confirmed, processing, failed, or review-required status from the server. |
| W11 | Sign in | `/sign-in` | Request and verify a phone OTP; use inline help during this sensitive step. |
| W12 | Account | `/account` | Manage customer preferences, language, addresses, guide replay, and sign out. |
| W13 | Saved addresses | `/account/addresses` | Add, edit, delete, or select an address; explain the default delivery address. |
| W14 | My orders | `/account/orders` | Find orders from either channel and start a fresh reorder. |
| W15 | Order detail / tracking | `/account/orders/[orderId]` | See payment and delivery status, tracking, receipt, and allowed support/cancellation actions. |
| W16 | Privacy policy | `/policies/privacy` | Explain personal-data use, account support, and the actual retention/contact policy. |
| W17 | Terms | `/policies/terms` | Explain purchase terms and applicable customer responsibilities. |
| W18 | Shipping policy | `/policies/shipping` | Explain dispatch, serviceability, delivery estimates, and shipping exceptions. |
| W19 | Returns / refunds | `/policies/returns` | Explain cancellation, damaged/leaking parcels, and the approved refund procedure. |

Website navigation: brand/Home, Shop oil, Our Ghani, Delivery, Help, language, cart, and account. FAQ and Contact can sit under Help. Policies belong in the footer and relevant checkout links.

Home and Shop remain separately useful: Home introduces a first-time buyer to the business; Shop gives a repeat buyer immediate access to the packs. The primary Home CTA can go straight to the product when that shortens the journey.

## Flutter customer app — 15 screen types

| ID | Screen | Main job |
| --- | --- | --- |
| A01 | Home | Quick access to oil, the process story, and relevant current-order/reorder actions. |
| A02 | Shop | Browse the small catalogue and compare packs. |
| A03 | Product detail | Pack selection, quantity, delivery check, product facts, and add to cart. |
| A04 | Cart | Edit quantities and proceed to checkout. |
| A05 | Checkout | Address, verified phone, authoritative shipping quote, payment choice, and total. |
| A06 | Order result | Confirmed/pending/failed/review-required outcome and next action. |
| A07 | Sign in / OTP | Passwordless customer access with resend and recovery states. |
| A08 | Account | Preferences, language, addresses, Help, guide replay, and sign out. |
| A09 | Saved addresses | Address list plus add/edit forms presented as sheets or screen states. |
| A10 | Orders | Cross-channel history and repeat-order entry. |
| A11 | Order detail | Tracking, payment information, receipt, support, and permitted order actions. |
| A12 | Our Ghani | Actual brand/process story and media. |
| A13 | Help and contact | FAQ and WhatsApp/phone support in one app destination. |
| A14 | Delivery information | Local/national delivery explanation and PIN eligibility. |
| A15 | Policy viewer | One reusable viewer for Privacy, Terms, Shipping, and Returns/refunds. |

Compact-screen primary navigation: **Home · Shop · Cart · Orders · Account**. Cart has a quantity badge. Product and checkout screens use a clear back path. On larger supported devices, adapt navigation to a rail rather than stretching the phone bar.

The app exposes the same business capabilities as the website but can combine content destinations and use native sheets. It is a Flutter interface, not a website wrapper.

## Owner dashboard — 10 screen types

| ID | Screen / base route | Main job |
| --- | --- | --- |
| M01 | Owner sign-in — `/admin/sign-in` | Authenticate an authorized owner/staff member. |
| M02 | Overview — `/admin` | See orders needing action, low stock, payment exceptions, and basic period totals. |
| M03 | Orders — `/admin/orders` | Filter all website/app orders by payment, fulfillment state, and date. |
| M04 | Order detail — `/admin/orders/[orderId]` | Confirm, pack, dispatch, add tracking, handle cancellation/refund, and inspect event history. |
| M05 | Catalogue — `/admin/catalogue` | Edit published product facts, images, pack prices, and availability settings. |
| M06 | Inventory and batches — `/admin/inventory` | Receive packed stock, allocate batches, inspect reservations, and record stock adjustments. |
| M07 | Delivery rules — `/admin/delivery` | Manage local area, verified PIN eligibility, package/rate rules, COD, and delivery estimates. |
| M08 | Customers — `/admin/customers` | Find customer records and related orders for authorized support. |
| M09 | Content and media — `/admin/content` | Maintain English/Telugu process, FAQ, contact, and approved policy content. |
| M10 | Store settings and team — `/admin/settings` | Manage public business details, notification preferences, allowed staff roles, and audit activity. |

Payment secrets are configured securely outside public settings fields. Refund actions remain in the order detail screen. The catalogue shows stock summaries; the inventory screen owns physical stock changes and their audit trail.

## Onboarding and reusable states

Onboarding adds **no mandatory route**. A welcome sheet/dialog appears after the first successful sign-in, then optional contextual guidance introduces the page the customer is actually visiting. Each customer page type has a short localized introduction; actionable commerce pages can add one or two targeted steps. FAQ, story, and policy pages need only an unobtrusive explanation of what the page contains.

- Sign-in has request-OTP, verify-OTP, resend, invalid/expired code, and quota/network states.
- Cart has populated, empty, changed price, unavailable variant, and sign-in merge states.
- Checkout has checking PIN, eligible/ineligible, quote expired, offline, COD unavailable, payment pending, and recoverable payment failure states.
- Order result uses the backend outcome; a browser/app payment callback alone never produces confirmed fulfillment.
- Orders have signed-out, first-order empty, loading, populated, and connectivity states.
- Order detail distinguishes payment from fulfillment, including refund/return exceptions.
- Content has loading, missing translation/media, and graceful fallback behavior.
- Tours have available, started, dismissed, skipped, completed, and replay states. OTP and gateway payment are never interrupted by an overlay.
- Address editing, feedback after delivery, cancellation requests, and confirmation prompts reuse sheets/dialogs.

No dedicated registration, wishlist, loyalty, subscription, live driver map, search page, or promotional campaign page is required for the initial three-variant catalogue. These can be scoped later from actual customer usage.
