# Implemented screen map

Updated 20 October 2026. Counts refer to page/screen types, independent
of language, pack choices, individual order IDs and loading/error states.
Actual routing is in `apps/web/src/components/storefront.tsx`,
`admin-pages.tsx` and Flutter's `ui/app.dart`.

## Customer website: 19 page types

| Page | Route | Implemented purpose |
| --- | --- | --- |
| Home | `/` | Brand, product, process introduction and shopping entry |
| Shop | `/shop` | Compare 1/2/5 L packs and add to cart |
| Product | `/oil/groundnut` | Pack/quantity selection, delivery check and product facts |
| Our Ghani | `/our-ghani` | Supplied process story; real photos await owner assets |
| Delivery | `/delivery` | Exact PIN eligibility and delivery terms |
| FAQ | `/faq` | Product, account, delivery and order help |
| Contact | `/contact` | WhatsApp/call when support phone is configured |
| Cart | `/cart` | Quantity changes and checkout |
| Checkout | `/checkout` | Address, server quote, review and COD confirmation |
| Order result | `/order-result/{orderId}` | Confirmed server order and next steps |
| Sign in | `/sign-in` | Email login/create account/reset in one form |
| Account | `/account` | Language, saved details, guide replay and sign out |
| Address | `/account/addresses` | Save/edit one default address |
| Orders | `/account/orders` | Cross-channel history and reorder entry |
| Order detail | `/account/orders/{orderId}` | Fulfillment progress, payment, packs, address and reorder |
| Privacy | `/policies/privacy` | Current data behavior and pending business policy |
| Terms | `/policies/terms` | Checkout terms and pending seller details |
| Shipping | `/policies/shipping` | PIN/rate behavior and pending dispatch terms |
| Returns | `/policies/returns` | Pending approved returns/refunds procedure |

The four policy pages are implemented viewers with provisional copy.
They require owner-approved business text before live ordering.

## Android: 15 customer screen types plus welcome

| Screen | Purpose |
| --- | --- |
| Home | Brand and shopping entry |
| Shop | Pack catalogue |
| Product | Pack/quantity, PIN lookup and facts |
| Cart | Edit quantities and proceed |
| Sign in/create/reset | Native email account form |
| Account | Profile, language, address, guide and help |
| Edit name | Update customer display name |
| Delivery address | Edit/save default address; reused in checkout |
| Checkout review | Authoritative delivery quote and COD total |
| Order confirmation | Saved order and next actions |
| Orders | Shared history |
| Order detail | Status, payment, address and reorder |
| Our Ghani | Process story |
| Delivery information | PIN eligibility |
| Help/content viewer | FAQ, contact and the four policy topics |
| Welcome | Optional first-login introduction |

Android navigation uses Home · Shop · Cart · Orders · Account, a cart badge
and native back navigation. Larger tested layouts use a navigation rail.
Content topics share a viewer; sign-in/create/reset are form states.

## Owner website: seven working destinations

| Route | Capability |
| --- | --- |
| `/admin` | Recent orders, totals and available pack count |
| `/admin/orders` | Latest orders from both channels |
| `/admin/orders/{orderId}` | Customer/purchase facts and permitted status changes |
| `/admin/catalogue` | Pack price, stock and enabled state editing |
| `/admin/inventory` | Available packed-stock editing |
| `/admin/content` | Read-only published product facts |
| `/admin/settings` | Read-only current ordering/payment flags |

`/admin/sign-in` uses the shared email login and claim checks.
Delivery management and customers have explicit unavailable states; batch
ledgers, rich content editing, staff teams, courier tracking and refund
management are not implemented destinations.

## Reusable design and guidance

The website shares a customer shell, pack art, form controls, order summaries,
status indicators, tips and policy layouts. Flutter uses native Material
controls and the same brand/content direction. Owner tables/editors form a
separate task-focused layout.

A welcome appears once per account/surface version. Page tips explain the
page in English/Telugu and can be dismissed, skipped or replayed. Web and
Android progress is stored separately. Auth/password entry is not covered
by a tour. Browsing does not require login.

Empty, loading, offline, stale-quote, unavailable-stock, unsupported-PIN,
signed-out and permission-denied states preserve useful work and explain
the next action. Checkout never treats a client-generated total or an
unconfirmed payment as a saved order.
