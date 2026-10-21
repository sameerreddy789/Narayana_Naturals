# Narayana Naturals — product foundation

<!-- impeccable:product-schema 1 -->

Status: product foundation updated 20 October 2026. The Next.js website and Flutter Android app use a shared Firebase commerce contract. Local emulator integration, COD ordering and optional first-login/page guidance are implemented; hosted deployment and merchant/courier activation are release prerequisites. Current coverage and verification are recorded in [README.md](README.md).

## Platform

adaptive

The product has a customer website, a Flutter Android customer app, and an owner dashboard on the web. The current native build targets Android; iOS distribution is future scope. Each supported native platform should keep its expected navigation, accessibility, and system behavior.

## Stack

- **Confirmed by the user:** Next.js for the website, Flutter for the customer app, and Firebase for their shared backend.
- **Implementation:** TypeScript for the Next.js application and Node commerce API; Dart with FlutterFire for the app. Firebase Realtime Database and email/password Auth avoid the Firebase billing paths rejected by the owner.
- Share Firebase identities, data, API contracts, business rules on the server, design tokens, and translated content. TypeScript and Dart interfaces are separate implementations; common UI source code is not assumed.
- Registered Firebase project: `narayananaturals-6b5aa`; Android package: `com.narayananaturals.app`. Local integration uses the isolated `demo-narayana-naturals` emulator project. Web hosting, payment and shipping providers still require activation/configuration.

## Users

- Customers buying groundnut oil for their households, including existing local buyers and customers elsewhere in India.
- Telugu-speaking and English-speaking customers using phones; the website must also work on desktop.
- The owner and authorized staff managing products, packed stock, orders, dispatch, customer support, and store content.

## Product Purpose

Sell Narayana Naturals bull-driven wooden Ghani groundnut oil directly to customers. Make the production story understandable, make ordering and payment straightforward, and make repeat buying convenient.

Both sales channels must use one operational record. A customer who orders on the website should see that order in the app after signing in to the same account. An owner update must affect both channels.

Success should be measured through completed and repeat orders, fulfillment reliability, and contribution margin after packaging, payment, delivery, and returns costs. Targets have not been supplied.

## Positioning

The distinctive product fact in the brief is the business's bull-driven wooden Ghani process for groundnut oil. Show the actual process, people, equipment, and packaging when the owner supplies those assets.

Do not invent extraction temperatures, organic certification, medical benefits, test results, customer reviews, FSSAI numbers, or business history.

## Operating Context

- **Confirmed launch coverage:** local delivery and nationwide shipping from launch. Nationwide coverage still depends on serviceable PIN codes and the selected courier accepting the actual edible-oil packaging.
- Local delivery and courier shipping require separate eligibility, pricing, delivery estimates, and COD rules.
- The supplied catalogue starts with one oil product and three pack variants: 1 litre, 2 litres, and 5 litres.
- The supplied starting prices are illustrative: INR 450, INR 900, and INR 2,250 respectively. Confirm sell prices, MRP, tax treatment, and packaged weights before publication.
- The original attachment discussed a lean website budget of INR 5,000–15,000. That estimate does not establish the budget for the newly selected custom website, Flutter app, and backend.

## Capabilities and Constraints

Current private client demonstration (21 October 2026): real Firebase email
accounts, addresses and carts work on both clients. At the owner's request,
checkout collects an address for PIN 517502, shows labelled example prices
and a ₹0 demo delivery fee, then confirms a simulated payment. It collects no
money, offers no COD, creates no backend order and reserves no physical stock.
Receipts stay locally on the browser/Android installation, isolated by UID.
Production order sharing remains the intended behavior after merchant activation.

Requirements carried forward from the brief:

- Catalogue, product facts, pack selection, cart, quantity changes, and checkout.
- Customer email account, name, delivery contact mobile number, address, and PIN code.
- Online/UPI payment and COD where the business and delivery service support it.
- Delivery eligibility, charges, order confirmation, tracking, and order history.
- Shared accounts and orders across website and app.
- Owner control of prices, availability, orders, and delivery settings.
- English and Telugu content and a visible language selector.
- First-login onboarding, optional introductions to each customer page, and a guided tour that can be skipped and replayed.
- WhatsApp contact, customer feedback, and a convenient repeat-order action.
- Public food/product information and customer policies that reflect the business's actual details.

Proposed defaults for the first release:

- Browse and build a cart without signing in; use email/password at checkout. Create account and password reset are states of the same sign-in screen.
- One product with three variants, rather than three disconnected product records.
- Firebase Auth supplies the common customer UID. Orders and addresses belong to that UID.
- A signed-in cart synchronizes across devices. A guest cart stays on its current device until it is merged on sign-in.
- The implemented v1 Node API enforces quotes, packed stock, idempotent COD orders and order transitions using Realtime Database. Online payment, refunds and reservation workers belong to a later merchant integration.
- A responsive owner dashboard manages both channels; a separate owner mobile app is outside the first release.
- Firebase remembers onboarding progress. Website and app guidance account for their different navigation; guidance does not interrupt password entry or order confirmation.
- Reorder copies previously purchased variants into a new cart and rechecks current price, stock, and delivery eligibility.

## Brand Commitments

- Brand name: **Narayana Naturals**.
- Owner-supplied logo: green leaf and circular stem, brown grain, and outlined Narayana Naturals lettering. The original and enhanced scalable assets are retained in [design/brand](design/brand/README.md).
- Product description: traditional bull-driven wooden Ghani groundnut oil.
- Language coverage: English and Telugu.
- Communication should be direct, local, and understandable; essential product facts and charges must be easy to find.
- Reference links in the brief illustrate commerce patterns. They are not owned product photographs or authorization to copy another brand's identity.

## Evidence on Hand

- User's project description in this conversation.
- Launch-plan attachment: `C:/Users/samee/.codex/attachments/e020e725-a93b-4bac-96a1-65992cb4a6a3/Pasted text.txt`.
- User-confirmed delivery choice: local and nationwide shipping from launch.
- User-confirmed frontend choice: Next.js website and Flutter app.
- The Next.js storefront, owner controls and shared Firebase backend are implemented, with a native Flutter Android client. The owner supplied the logo and Firebase web/Android configuration; enhanced brand assets are saved in `design/brand`. Owner Firebase CLI authorization is verified. Actual product/production photographs, production courier rules, merchant credentials and live Firebase service provisioning are still pending.

## Product Principles

1. One customer and order record across both customer channels.
2. Show truthful product evidence and the complete payable amount before purchase.
3. Keep first-time ordering and repeat ordering short and understandable.
4. Treat stock, payment, and fulfillment as different facts that the server reconciles.
5. Prefer a small catalogue and dependable operations over additional shopping features.

## Accessibility & Inclusion

- Both languages must cover navigation, checkout, errors, order states, and essential policies, not just the home page.
- Accept Unicode names and addresses; support Indian phone numbers and six-digit PIN codes.
- Proposed quality target: WCAG 2.2 AA for the website; native screen-reader, system text-size, and touch-target support for the app.
- Keep low-bandwidth ordering usable with optimized images, recoverable network errors, and preserved form/cart state.

## Open Business Decisions

- Whether to add iOS distribution after the current Android build.
- Final prices, MRP, taxes/invoice details, stock counts, shelf-life and storage statements, and packed weights/dimensions.
- Origin address/PIN, local service area, local delivery fees, courier serviceability and rates, COD eligibility and limits.
- Payment merchant/provider and shipping provider; approved merchant credentials.
- Actual product/production photographs, customer support number, verified food-business details, and approved policy text.
- Current implementation budget and operating budget.

These decisions do not prevent completing the architecture and UX blueprint. Merchant, fulfillment, and product facts must be supplied before accepting live orders.
