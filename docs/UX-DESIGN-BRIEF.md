# UX and design brief

Status: recommended direction with a runnable Next.js preview; final visual approval and actual product/Ghani photography are still pending. Product facts live in [PRODUCT.md](../PRODUCT.md); target screen counts live in [SCREEN-MAP.md](SCREEN-MAP.md). Current implemented preview coverage is recorded in [README.md](../README.md).

## Experience and visual direction

The storefront should feel like a careful local food producer with a straightforward shopping experience. Ground the visual identity in the actual wooden Ghani, groundnuts, oil, and packaging. The characteristic element is a strong close photograph of the real Ghani process alongside an immediate route to choose a pack.

Use the expressive brand treatment on Home and Our Ghani. Use quieter, task-oriented layouts for Product, Checkout, Orders, and the owner dashboard. Help and policies prioritize reading. Do not turn every screen into a marketing page.

Proposed palette:

| Token | Color | Use |
| --- | --- | --- |
| Leaf | `#183A28` | Primary actions, selected controls, and brand ink |
| Pistachio | `#F3F6EC` | Light storefront background |
| Oil gold | `#D9A52C` | Small product accents and selected surfaces with dark text |
| Raw wood | `#70543E` | Restrained process/story accent |
| Charcoal | `#202720` | Primary reading text |
| Clear surface | `#FFFFFF` | Product, form, and document surfaces |

Gold is not a small-text color on white. Map these choices to semantic interaction, surface, text, border, and error tokens. Native apps also need properly designed dark and increased-contrast schemes rather than a color inversion.

Proposed typography:

- Anek Telugu for restrained brand/headline moments; evaluate both Telugu and Latin rendering with the actual brand name.
- Source Sans 3 for English web body, labels, prices, and forms; use tabular figures where prices align.
- Noto Sans Telugu for Telugu reading and form content. Avoid extra letter spacing in Telugu.
- Native app controls/body follow platform type roles and system text sizing, with a Telugu-capable fallback. Brand display type stays in brand moments.

Keep surfaces quiet, corners consistent, photography useful, and the order total prominent. No fabricated reviews, arbitrary certification badges, decorative dashboards, stock photos presented as this business, or unsupported health claims.

## Customer journeys

First order:

`Home or shared product link → choose pack/quantity → cart → verify phone and address → check PIN and final quote → pay or eligible COD → backend-confirmed result → tracking`

Repeat order:

`Sign in on either channel → My orders → Order again → review current stock/prices → refresh address/delivery/payment → new order`

The first-login guide introduces these tasks without forcing an onboarding course. Browsing remains available before sign-in. Checkout verification creates the customer identity without a separate registration form.

## Key layout requirements

### Home

Show the brand, what is sold, and a clear Shop oil action within the first viewport. Actual process/product media supplies the proof. Follow with pack options, a concise process explanation, delivery information, and Help/contact links. Publish business/licence details only when supplied and verified.

```text
Brand      Shop oil   Our Ghani   Delivery   Help     Language   Cart

Traditional Ghani groundnut oil   | Actual Ghani / product photo
Short, factual description       | One clear photographic focus
[Shop oil] [See our process]     |

Choose a pack:       1 L              2 L              5 L
                    Price            Price            Price

Actual process → Delivery information → Help → Business/policy footer
```

At mobile width, the product purpose and Shop action appear early; media and pack options stack. Avoid a slow autoplay background video. Process video, if supplied, starts on an explicit play action.

### Product detail

Place product name, image, pack choices, price, stock status, quantity, and Add to cart together. Place PIN eligibility near the purchase controls. Show ingredients, extraction method, supplied food/label information, storage, pack details, and relevant delivery/refund links below.

```text
Actual product image | Ghani groundnut oil
                    | Pack: [1 L] [2 L] [5 L]
                    | Price • stock status
                    | Quantity [−] [1] [+]
                    | Delivery PIN [______] [Check]
                    | [Add to cart] [Buy now]
Product facts • Process • Storage • Delivery and returns
```

Use one product record with variants. Buy now enters checkout for the selected pack and preserves any existing cart rather than silently discarding it. Add to cart gives concise feedback and a visible route to view the cart.

### Cart and checkout

The cart permits quantity changes and explains that the final delivery quote is calculated from the address. Do not display an unknown shipping charge as zero.

Mobile checkout is one short vertical flow; desktop can keep an order summary beside the form. Use address → delivery quote → payment → final review. Preserve entered information after authentication and recoverable errors.

```text
Delivery address and verified phone | Items and quantities
PIN eligibility / delivery estimate | Item subtotal
Payment: online or eligible COD     | Shipping and COD fee, if any
                                    | Applicable tax treatment / total
[Review / Pay amount / Place COD order]
```

Labels describe the action: Pay INR amount for online checkout; Place order for COD. The final total contains all charges and applicable tax treatment without double-counting tax. An unavailable PIN or missing valid rate blocks purchase with a clear next action.

### Orders

Show readable status, date, packs, and total in the history list. Order detail distinguishes payment from delivery and includes an event timeline, courier/local tracking information, support, receipt, and permitted cancellation/reorder actions. A first-order empty state links to the product.

### Owner dashboard

Use a compact navigation rail/sidebar and tables with readable statuses. Overview prioritizes work requiring attention: orders to process, low stock, and payment/refund exceptions. Order detail places the current allowed action beside customer, item, payment, and delivery information. Confirmation prompts clearly identify irreversible financial or fulfillment actions.

## First-login onboarding and page guidance

Terminology: **onboarding** introduces the service; a **guided tour** or **contextual walkthrough** explains a page's controls.

Behavior:

1. After the first successful login, offer a short welcome with Start guide and Skip. If sign-in occurred during checkout, defer the welcome overlay until the transaction reaches a safe stopping point; small inline help remains available.
2. Explain the current page, rather than automatically navigating through every page. Home introduces Shop, language, and Orders. Product introduces pack selection and cart. Cart introduces quantity and checkout. Checkout explains address/PIN, the full total, and payment choice. Orders introduces tracking and reorder. Account introduces preferences, addresses, and guide replay.
3. Give every customer page type a concise localized introduction. Content/policy pages use a nonblocking tip; commerce pages may have one or two anchored steps with Next, Back, Skip, and Done.
4. Provide Skip throughout and Replay guide in Help/Account. Tours must not create orders, change quantities, request unnecessary permissions, or cover the payment gateway or OTP controls.
5. Record progress in Firebase by user, surface, and guide version. Website progress follows the customer to another browser; app progress follows them to another app device. Platform-specific guidance is distinct because navigation differs.
6. Remember a skipped guide as skipped for that version. Replay is explicit. A new guide version does not automatically restart the entire tour on every customer.

Example copy, subject to native Telugu review:

| Context | English draft |
| --- | --- |
| Welcome | Choose your oil pack, check delivery to your PIN code, and follow your order here. |
| Product | Choose 1, 2, or 5 litres. The price and availability update for your selected pack. |
| Cart | Change quantities here. We calculate the final delivery charge after you enter your address. |
| Checkout | Check your address and full total, then choose online payment or cash on delivery where available. |
| Orders | Orders from the website and app appear here when you use the same account. |
| Reorder | Order again adds these packs to a new cart using today's prices and availability. |

The tour is keyboard and screen-reader accessible. If an anchored target is offscreen, unavailable, loading, or hidden at the current width, use the inline explanation or wait until it exists; never show a spotlight floating over the wrong element. Dismissal restores focus. Preserve normal reading order and respect reduced motion.

## Bilingual and native behavior

- Show English / తెలుగు on every customer page and in app account/navigation access.
- Translate navigation, page guidance, OTP/error messages, delivery rules, payment states, and policies. Shared content fields keep English/Telugu versions together.
- Save a signed-in language preference in Firebase. Allow a temporary device choice; changing language preserves the current page, selected pack, cart, address form, and order context.
- Format money as INR and quantities consistently. Permit Telugu customer names/addresses; do not apply Latin-only validation.
- Android follows Material 3 components, system/predictive Back, 48 dp touch targets, safe window/keyboard insets, and scalable typography.
- If iOS is included, preserve safe areas, native back behavior, platform controls, 44 pt touch targets, Dynamic Type, and Reduce Motion. Flutter sharing does not remove these platform requirements.
- Optimize real images; keep catalogue and cart recoverable on poor connectivity. Final checkout always requires an online authoritative quote and stock check.

## Design decisions still to confirm

Actual logo and photography, final product content, app launch platforms, and the recommended palette/type treatment. No visual direction has been presented as owner-approved. These decisions belong to the next design review with the key layouts and real assets available.
