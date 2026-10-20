# Narayana Naturals design system

The customer website and Flutter Android app extend the existing storefront
identity and the owner's supplied logo. Product and business facts are defined
in PRODUCT.md; the shared commerce data is defined in contracts/v1.

## Palette and typography

| Token | Value | Role |
| --- | --- | --- |
| Leaf | #183a28 | Primary actions and headings |
| Leaf hover | #254b35 | Web hover state |
| Pistachio | #f3f6ec | Quiet supporting surfaces |
| Oil | #d9a52c | Restrained product accent |
| Wood | #70543e | Process/story details |
| Ink | #202720 | Main text |
| Muted | #626b60 | Supporting text on light surfaces |
| Surface | #ffffff | Form and product surfaces |
| Border | #dce2d4 | Separation |
| Error | #a12c2c | Recoverable error messages |

The website uses Anek Telugu Variable for display text, Source Sans 3 for
English body text, and Noto Sans Telugu for Telugu. The Android app uses the
same available font assets with native text scaling and Material controls.
The owner-provided enhanced logo is the brand asset; pack art is an explicitly
illustrative packaging concept, not a photograph of the delivered bottle.

## Customer surfaces

The shopping flow prioritizes pack size, current price and stock, quantity,
delivery eligibility, the full total, and one clear next action. Product story
and storage information are available alongside those choices. Large touch
targets, readable text, meaningful focus states, and short error recovery copy
apply in both languages.

On the website, use the existing responsive header, page width and form styles.
On Android, use safe areas, a native navigation stack and bottom navigation for
Home, Shop, Cart, Orders and Account. Checkout and authentication are focused
screens inside that stack. Preserve Android back behavior and text scaling.

## Shared states and guidance

Every asynchronous flow has explicit loading, empty, success and recoverable
failure states. A failed live request cannot create a demo order. Sample data
and payments have visible preview labels, and missing merchant setup does not
produce an online payment success message.

First-login welcome and page guidance can be skipped, dismissed and replayed.
Firebase progress is scoped to the authenticated UID and guide surface version;
the guide explains controls without changing the cart or placing an order.

Keep the established visual system when adding features. Business claims,
customer reviews, certification and actual photography require supplied facts.
