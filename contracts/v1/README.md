# Commerce contract v1

Next.js and Flutter use this same contract. Callable Functions are in `asia-south1` and every mutation requires Firebase Authentication. All money is an integer number of **paise**, currency is INR, variant identifiers are `1l`, `2l`, `5l`, and API/order times are ISO-8601 UTC strings. The function name is the contract version boundary for this first implementation; breaking changes need new names or an explicit version migration.

## Public and customer documents

| Path | Shape and access |
| --- | --- |
| `products/groundnut-oil` | `{published, name:{en,te}, description:{en,te}, ingredients:{en,te}, extraction:{en,te}, storage:{en,te}}`. Only published products are customer readable. |
| `products/groundnut-oil/variants/{id}` | `{id, litres, pricePaise, stock, enabled}`. `stock` is a server-maintained available-pack projection; clients cannot write prices or stock. |
| `publicContent/storefront` | `{orderingEnabled, onlinePaymentsEnabled:false, preview, supportPhone?, notice:{en,te}?}`. Missing/disabled settings prevent checkout. Sample data works only in emulators. |
| `deliveryRules/{pin}` | `{enabled,local,feePaise,extraLitrePaise?,includedLitres?,codAllowed,estimate}`. `estimate` is a short display string; exact six-digit PIN rules, never an unchecked nationwide wildcard. |
| `users/{uid}` | `{displayName,phoneNumber,language}`. `phoneNumber` must equal the verified `+91…` Auth number; `language` is `en` or `te`. No client roles. |
| `users/{uid}/addresses/default` | `{name,phone,street,city,pin}`. `phone` is ten Indian mobile digits; `pin` is six digits. Unicode names/addresses accepted. |
| `carts/{uid}` | `{lines:[{id,quantity}],updatedAt}`. Unique IDs, quantity 1–20, at most three entries; `updatedAt` is a Firestore `serverTimestamp()`. Prices/totals cannot be stored here. |
| `users/{uid}/onboarding/{web-v1\|android-v1}` | `{welcomeSeen,skipped,dismissedPages}`. Guide progress belongs to the authenticated user. |
| `orders/{id}` | `{id,uid,customerPhone,createdAt,lines,address,subtotalPaise,shippingPaise,totalPaise,paymentMethod:'cod',paymentStatus:'pending_collection'\|'collected'\|'cancelled',status,channel,preview}`. Readable by the order owner or an `admin:true` claimant; all writes are server-only. |

Order line shape: `{id,quantity,litres,unitPricePaise}`. Order address shape is the saved-address shape above. Statuses are `received`, `packed`, `shipped`, `delivered`, `cancelled`; channels are `web` or `android`. `createdAt` is server-authored and sortable as an ISO UTC string. An order is an immutable purchase-time snapshot except for authorized status/payment metadata. Catalogue/address edits do not rewrite its purchase facts.

Customers query orders with `where('uid','==',auth.uid)`, `orderBy('createdAt','desc')`, and `limit(50)` (or another limit of at most 100). Owners query a bounded list with `orderBy('createdAt','desc')` and `limit(100)`. Unbounded order lists are denied. Auth custom claim `{admin:true}` is provisioned using trusted Admin SDK tooling; a document/profile field never grants access.

Emulator fixture catalogue, variant, private inventory and delivery documents carry an additional `preview:true` marker. Checkout rejects **any** preview marker outside the Functions emulator, even if the storefront marker was cleared. Every emulator order is labelled preview. Catalogue `stock` is the public projection of server-only `_inventory/{id}.availablePacks`; clients cannot read that private collection. Onboarding page IDs are distinct nonempty strings of at most 64 characters, with at most 20 dismissed pages.

## Callables

| Function | Request | Response |
| --- | --- | --- |
| `quoteCheckout` | `{lines:[{id,quantity}],address,channel}` | `{quoteId,subtotalPaise,shippingPaise,totalPaise,codAllowed,estimate,expiresAt,preview,lines}` |
| `placeCodOrder` | `{quoteId,idempotencyKey}` | `{orderId}` |
| `updateVariant` | `{id,pricePaise,stock,enabled}` | `{id}`; admin claim required |
| `updateOrderStatus` | `{orderId,status}` | `{orderId,status}`; admin claim required |

Quotes require a verified Indian Firebase Auth phone number. They last **ten minutes**, belong to that UID, and do not reserve stock. `placeCodOrder` checks the quote owner, expiry, current product/price/delivery settings and stock in one Firestore transaction. Changed terms return `QUOTE_CHANGED` and require a new visible quote. The same quote can create only one order. `idempotencyKey` is a stable 8–128 character identifier (`[A-Za-z0-9_-]`); retain it during retries. A used key cannot be rebound to another quote. Retrying a completed operation returns the original order even after quote expiry.

Server totals are authoritative. Shipping is `feePaise + max(0,totalLitres - includedLitres) * extraLitrePaise`, with omitted surcharge fields treated as zero. Stock is counted in **packs**, not litres. COD is the only implemented payment path. A missing merchant integration must never result in an online-payment success label.

Order creation does not mutate `carts/{uid}`. Once `{orderId}` confirms success, each client transactionally removes only the purchased lines whose quantities still match the reviewed purchase snapshot. Later edits and unrelated packs survive. The persisted cart contains `{lines:remainingLines,updatedAt:serverTimestamp()}` and the local cart reflects the merged result. An ancillary cart-sync failure must not discard the successful order result or replace its stable retry key.

Order transitions: `received → packed → shipped → delivered`; `received` or `packed` may become `cancelled`. Cancellation restores packed stock exactly once. Shipped/delivered orders cannot be cancelled by this function; physical returns and refunds require a future explicit workflow. COD becomes `collected` on `delivered`; cancellation becomes payment status `cancelled`.

## Errors

Catch Firebase's callable error and read `error.details.code`; translate in each client. Native Firebase `unauthenticated`/`permission-denied` errors remain meaningful if no details are present.

| Machine code | Meaning |
| --- | --- |
| `AUTH_REQUIRED` | Sign in first. |
| `PHONE_REQUIRED` | A verified Indian phone is required. |
| `ADMIN_REQUIRED` | This operation requires the owner claim. |
| `INVALID_INPUT` | Invalid fields, quantities, address or identifiers. |
| `STORE_NOT_READY` | Ordering disabled, setup missing, or sample configuration used outside an emulator. |
| `NOT_SERVICEABLE` | No enabled delivery rule for the exact PIN. |
| `OUT_OF_STOCK` | A pack is disabled, unpublished or unavailable. |
| `QUOTE_EXPIRED` | Review a new quote. |
| `QUOTE_CHANGED` | Prices/delivery terms changed; review a new quote. |
| `QUOTE_NOT_FOUND` | Quote is missing. |
| `QUOTE_OWNER_MISMATCH` | Quote belongs to another account. |
| `COD_UNAVAILABLE` | This PIN does not support COD. |
| `IDEMPOTENCY_CONFLICT` | Retry key was already used for another quote. |
| `ORDER_NOT_FOUND` | Order does not exist. |
| `INVALID_TRANSITION` | Unsupported order status change. |
| `RATE_LIMITED` | Wait before making more checkout requests. |

The full wire schema is in `schema.json`. Emulator seed prices, stock and local/nationwide PIN examples are explicitly illustrative and never published to the real Firebase project by the seed script.
