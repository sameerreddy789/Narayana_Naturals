# Commerce contract v1

Next.js, Flutter and the Node API use the same wire contract.
Money is an integer number of **paise**, currency INR, and variants are
`1l`, `2l`, `5l`. RTDB/API times are integer epoch milliseconds.
The website converts those times to ISO strings inside its UI only.

The API version boundary is `/v1/`. Validate the payload against the
named definitions in [schema.json](schema.json). Runtime validation also
checks unique pack IDs, matching variant volumes, arithmetic and ownership.

## Data paths and permissions

| Path | Shape/access |
| --- | --- |
| `commerce/products/groundnut-oil` | Published bilingual product facts; public read when published |
| `commerce/variants/{id}` | `{id,litres,pricePaise,stock,enabled,preview?}`; public read, server write |
| `commerce/publicContent/storefront` | `{orderingEnabled,onlinePaymentsEnabled:false,preview,supportPhone?,notice?}` |
| `commerce/deliveryRules/{pin}` | `{enabled,local,feePaise,extraLitrePaise?,includedLitres?,codAllowed,estimate,preview?}` |
| `users/{uid}/profile` | `{displayName,email,language,phoneNumber?}`; own UID only; email matches Auth token |
| `users/{uid}/addresses/default` | `{name,phone,street,city,pin}`; own UID read/write |
| `users/{uid}/onboarding/{web-v1\|android-v1}` | `{welcomeSeen,skipped,dismissedPages?}`; own UID only |
| `carts/{uid}` | `{lines?,updatedAt}`; own UID read/write; unique pack quantities 1–20 |
| `commerce/ordersByUser/{uid}/{orderId}` | Customer/owner read; server-only write |
| `commerce/orderIndex/{orderId}` | Trusted owner read; server-only write |
| `commerce/quotes/{quoteId}` | Private server quote |
| `commerce/idempotency/{hash}` | Private durable retry receipt |
| `commerce/limits/{hash}` | Private request limit record |

RTDB removes null/empty children. An empty cart may therefore contain only
`updatedAt`; an empty guide has no `dismissedPages`. Clients normalize
omitted/null children to empty lists. Cart update times use the database
server timestamp sentinel. Arrays use indexed children under RTDB.

Customer history subscriptions order by `createdAt` and take the latest
50 records; the owner index takes the latest 100. Rules scope history to UID
and owner index to `admin:true`. These are client bounds; personal history
reads are permitted at the customer's node rather than a query-enforced cap.

Profiles use email/password identity. Optional profile phones and
`address.phone` are delivery contacts, not verified Auth phone numbers.
Order `customerPhone` is `+91` plus the ten-digit address phone.
Unicode names/addresses are accepted with length/control-character validation.

Product facts use bilingual `{en,te}` fields for name, description,
ingredients, extraction and storage. A configured support phone uses
international Indian digits for WhatsApp/call. Preview records cannot
authorize live purchases.

## HTTP operations

Send `Content-Type: application/json` and
`Authorization: Bearer <Firebase ID token>`. Live requests additionally send
`X-Firebase-AppCheck`. The request and successful response envelopes are
`{"data": <payload>}`.

| POST endpoint | Request | Response payload |
| --- | --- | --- |
| `/v1/quoteCheckout` | `{lines,address,channel}` | `{quoteId,subtotalPaise,shippingPaise,totalPaise,codAllowed,estimate,expiresAt,preview,lines}` |
| `/v1/placeCodOrder` | `{quoteId,idempotencyKey}` | `{orderId}` |
| `/v1/updateVariant` | `{id,pricePaise,stock,enabled}` | `{id}`; owner claim required |
| `/v1/updateOrderStatus` | `{orderId,status}` | `{orderId,status}`; owner claim required |

`GET /health` returns connection/configuration status. It does not validate
the whole catalogue or authorize checkout.

A quote requires an email/password Firebase token, lasts ten minutes, belongs
to its UID and does not reserve stock. Place-order rechecks current product,
price, PIN delivery terms and stock in one transaction at `/commerce`.
Changed terms require a new quote that the customer can review.

Each order contains ID/UID, server creation time, immutable purchase-time
lines/address/totals, `paymentMethod:'cod'`, payment/fulfillment status,
source `channel:'web'|'android'` and a preview flag.
Both customer and owner order copies are written atomically with stock and
retry receipt. Authorized fulfillment updates add server `updatedAt`.

Shipping is
`feePaise + max(0,totalLitres - includedLitres) * extraLitrePaise`.
Omitted surcharge fields default to zero. Stock counts packs, not litres.
COD is the only implemented payment path.

## Safe retries and cart cleanup

Retain a stable quote ID and 8–128 character retry key
(`[A-Za-z0-9_-]`) before submitting. A completed key returns its original
order even after quote expiry or a backend restart. A key cannot be rebound
to another quote; a consumed quote cannot create another order.

An ambiguous timeout keeps the original checkout reference. A definitive
quote/input/stock/configuration/capacity rejection can clear an unconfirmed
review so the customer can review a fresh quote.

Order creation does not write the cart. Once confirmed, clients transactionally
remove only purchased pack quantities that still match the reviewed snapshot.
Later quantities and unrelated packs survive. Ancillary cleanup failure does
not erase the successful order or its durable recovery reference.

Fulfillment is `received → packed → shipped → delivered`.
Received/Packed can become Cancelled, restoring packs exactly once.
Delivered COD becomes Collected; cancellation has no COD due.
Shipped/Delivered cancellation and financial returns need a future workflow.

## Errors and capacity

Error envelope:
`{"error":{"code":"MACHINE_CODE","message":"...","details":{"nativeCode":"..."}}}`.
Clients translate machine codes and retain safe retry state for uncertain
failures. Auth/rule/transport errors remain meaningful without an API envelope.

| Code | Meaning |
| --- | --- |
| `AUTH_REQUIRED` | Firebase sign-in missing/invalid |
| `EMAIL_REQUIRED` | Checkout requires email/password provider |
| `ADMIN_REQUIRED` | Trusted owner claim required |
| `APP_CHECK_REQUIRED` | Live application verification failed/missing |
| `ORIGIN_NOT_ALLOWED` | Website origin is outside the CORS allowlist |
| `INVALID_INPUT` | Invalid/missing/unexpected fields |
| `STORE_NOT_READY` | Ordering/configuration missing or live preview markers |
| `NOT_SERVICEABLE` | Exact PIN has no enabled delivery rule |
| `OUT_OF_STOCK` | Product/pack unavailable or insufficient stock |
| `QUOTE_EXPIRED`, `QUOTE_CHANGED` | Review a fresh quote |
| `QUOTE_NOT_FOUND`, `QUOTE_OWNER_MISMATCH` | Missing/foreign quote |
| `COD_UNAVAILABLE` | PIN does not permit COD |
| `IDEMPOTENCY_CONFLICT` | Retry key already bound to another quote |
| `ORDER_NOT_FOUND`, `INVALID_TRANSITION` | Missing order/unsupported status change |
| `RATE_LIMITED` | Per-account operation limit exceeded |
| `STORE_CAPACITY` | Bounded ledger requires a capacity upgrade |
| `UNAVAILABLE` | Unknown service/transport result; retry safely |

The initial ledger limits are 500 orders, 2,000 receipts, 750 quote records,
1,000 limit records and 4 MiB JSON. It uses full-ledger transactions and is
intended for a small initial store. Completed receipts/consumed quotes remain
durable; capacity errors do not silently erase purchase history. Expired
unconsumed quotes are pruned after a grace period. Scaling/retention needs
a migration that preserves deduplication.
