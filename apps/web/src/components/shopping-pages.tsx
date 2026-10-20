"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Leaf, MapPin, Minus, Plus, ShoppingBag, Truck, X } from "lucide-react";
import { cartSubtotal, money, type Address, type PackId } from "@/lib/demo";
import { PACK_LITRES, errorCode, languageText, validateAddress, type DeliveryCheck } from "@/lib/commerce";
import { activeCheckoutReview, canReplaceCheckoutReview, checkoutHasContent, readCheckoutReview, removeCheckoutReview, retainCheckoutAttempt, saveCheckoutReview, type CheckoutReview } from "@/lib/checkout";
import { usePreview } from "./preview-provider";
import { ProductArt } from "./product-art";
import { EmptyState, PageHeading } from "./storefront";
import { DataStatus } from "./data-status";

const emptyAddress = (): Address => ({ name: "", phone: "", street: "", city: "", pin: "" });

function PackCards() {
  const { state, t, addPack, ready, catalogueReady, catalogueAvailable, catalogueError, accountReady, cartBusy } = usePreview();
  if (!catalogueReady) return <DataStatus loading={t("Loading oil packs…", "నూనె ప్యాక్‌లు లోడ్ అవుతున్నాయి…")} />;
  if (catalogueError) return <DataStatus error={catalogueError} />;
  if (!catalogueAvailable) return <EmptyState title={t("Oil packs are unavailable right now", "ప్రస్తుతం నూనె ప్యాక్‌లు అందుబాటులో లేవు")} description={t("Please check back soon or contact the business.", "కొద్దిసేపటి తరువాత చూడండి లేదా వ్యాపారాన్ని సంప్రదించండి.")} action={t("Contact", "సంప్రదించండి")} href="/contact" />;
  const labels = [t("For a little everyday cooking", "రోజువారీ వంట కోసం"), t("A familiar kitchen companion", "మీ వంటింటి కోసం"), t("For the family pantry", "కుటుంబం కోసం")];
  return <div className="product-grid">{state.variants.map((variant, index) => <article className="product-card" key={variant.id}>
    <Link className={"product-card-art art-" + variant.id} href={"/oil/groundnut?pack=" + variant.id} aria-label={t("View", "చూడండి") + " " + variant.litres + " " + t("litre pack", "లీటర్ల ప్యాక్")}><ProductArt pack={variant.id} /></Link>
    <div className="product-card-content"><div className="product-card-title"><h3>{variant.litres} {t(variant.litres === 1 ? "litre" : "litres", "లీటర్లు")}</h3><strong>{money(variant.pricePaise)}</strong></div><p>{labels[index]}</p>
      <button className="button secondary" onClick={() => void addPack(variant.id)} disabled={!ready || !accountReady || cartBusy || !variant.enabled || variant.stock === 0}>
        {!variant.enabled ? t("Unavailable", "అందుబాటులో లేదు") : variant.stock === 0 ? t("Out of stock", "స్టాక్ లేదు") : cartBusy ? t("Updating cart…", "కార్ట్ మారుతోంది…") : t("Add to cart", "కార్ట్‌లో చేర్చండి")}<Plus size={17} />
      </button>
    </div>
  </article>)}</div>;
}

export function HomePage() {
  const { t } = usePreview();
  return <>
    <section className="hero page-width"><div className="hero-copy"><h1>{t("From our Ghani.", "మా ఘానీ నుంచి.")}<br /><span>{t("To your kitchen.", "మీ వంటింటికి.")}</span></h1><p>{t("Groundnut oil made the traditional way in a bull-driven wooden Ghani. A simple choice for your everyday cooking.", "ఎద్దుల సాయంతో నడిచే చెక్క ఘానీలో సాంప్రదాయ పద్ధతిలో తయారైన వేరుశెనగ నూనె. మీ రోజువారీ వంట కోసం.")}</p><div className="hero-actions"><Link className="button primary" href="/shop">{t("Explore our oil", "మా నూనె చూడండి")}<ArrowRight size={19} /></Link><Link className="text-link" href="/our-ghani">{t("Meet our Ghani", "మా ఘానీ గురించి")}<ArrowRight size={16} /></Link></div><div className="hero-facts"><span><Leaf size={17} />{t("Bull-driven Ghani", "ఎద్దులతో నడిచే ఘానీ")}</span><span><ShoppingBag size={17} />{t("1, 2 & 5 litre packs", "1, 2 మరియు 5 లీటర్లు")}</span></div></div><div className="hero-art"><div className="hero-art-title">{t("Ghani groundnut oil", "ఘానీ వేరుశెనగ నూనె")}</div><div className="hero-pack-collection"><ProductArt pack="2l" className="hero-pack-back" /><ProductArt pack="1l" className="hero-pack-front" /></div><div className="hero-art-bottom"><span>{t("Traditional by nature.", "సాంప్రదాయ సహజత్వం.")}</span><span>1 L · 2 L · 5 L</span></div><p className="art-caption">{t("Packaging concept · Actual product photos to follow", "ప్యాకేజింగ్ నమూనా · అసలు ఉత్పత్తి ఫోటోలు తరువాత")}</p></div></section>
    <section className="shop-section page-width"><div className="section-heading"><div><h2>{t("A pack for your kitchen", "మీ వంటింటికి ఒక ప్యాక్")}</h2><p>{t("One groundnut oil. Three useful sizes.", "ఒక వేరుశెనగ నూనె. మూడు పరిమాణాలు.")}</p></div><Link href="/shop" className="text-link">{t("View all packs", "అన్ని ప్యాక్‌లు చూడండి")}<ArrowRight size={16} /></Link></div><PackCards /></section>
    <section className="process-section"><div className="page-width process-inner"><div><h2>{t("The wooden Ghani is where our story begins.", "చెక్క ఘానీతో మా కథ మొదలవుతుంది.")}</h2><p>{t("Narayana Naturals brings a traditional bull-driven process to the groundnut oil you choose for your home. We want you to know the process behind your purchase.", "నారాయణ నేచురల్స్ సాంప్రదాయ ఎద్దులతో నడిచే ఘానీ పద్ధతిలో వేరుశెనగ నూనె అందిస్తుంది. మీ కొనుగోలు వెనుక పద్ధతిని తెలుసుకోండి.")}</p><Link href="/our-ghani" className="button light">{t("Read our story", "మా కథ చదవండి")}<ArrowRight size={18} /></Link></div><div className="process-words"><div><span>{t("The groundnuts", "వేరుశెనగలు")}</span><p>{t("The ingredient at the heart of our oil.", "మా నూనెలో ప్రధాన పదార్థం.")}</p></div><div><span>{t("The wooden Ghani", "చెక్క ఘానీ")}</span><p>{t("The traditional bull-driven extraction process.", "ఎద్దులతో నడిచే సాంప్రదాయ పద్ధతి.")}</p></div><div><span>{t("Your everyday kitchen", "మీ రోజువారీ వంటింటి")}</span><p>{t("Choose the pack that works for your household.", "మీ కుటుంబానికి సరైన ప్యాక్‌ను ఎంచుకోండి.")}</p></div></div></div></section>
    <section className="delivery-strip page-width"><Truck size={34} strokeWidth={1.4} /><div><h2>{t("Near home or further away", "దగ్గరగా లేదా దూరంగా")}</h2><p>{t("Local delivery around Chittoor and Tirupati, with courier shipping planned for eligible PIN codes across India.", "చిత్తూరు మరియు తిరుపతి ప్రాంతాలకు స్థానిక డెలివరీ, అర్హమైన భారతదేశ పిన్ కోడ్‌లకు కొరియర్ షిప్పింగ్ ప్రణాళిక.")}</p></div><Link href="/delivery" className="text-link">{t("Check delivery", "డెలివరీ చూడండి")}<ArrowRight size={18} /></Link></section>
  </>;
}

export function ShopPage() {
  const { t, mode } = usePreview();
  return <section className="page-width standard-page"><PageHeading title={t("Good oil. Your kind of pack.", "మంచి నూనె. మీకు సరైన ప్యాక్.")}
    description={mode === "firebase" ? t("Bull-driven wooden Ghani groundnut oil in 1, 2 and 5 litre packs. Choose your pack and review delivery at checkout.", "ఎద్దులతో నడిచే చెక్క ఘానీ వేరుశెనగ నూనె 1, 2 మరియు 5 లీటర్ల ప్యాక్‌లలో. ప్యాక్ ఎంచుకుని చెక్అవుట్‌లో డెలివరీ చూడండి.") : t("Bull-driven wooden Ghani groundnut oil in 1, 2 and 5 litre packs. Prices below are illustrative for this preview.", "ఎద్దులతో నడిచే చెక్క ఘానీ వేరుశెనగ నూనె 1, 2 మరియు 5 లీటర్ల ప్యాక్‌లలో. ఈ ప్రివ్యూలో ధరలు నమూనా మాత్రమే.")} />
    <PackCards /><p className="small-note">{t("Pack artwork is a packaging concept. Actual product photographs will be added with the owner's assets.", "ప్యాక్ చిత్రాలు ప్యాకేజింగ్ నమూనాలు. అసలు ఉత్పత్తి ఫోటోలు యజమాని ఆస్తులతో చేర్చబడతాయి.")}</p>
  </section>;
}

export function ProductPage() {
  const { state, mode, ready, t, addPack, catalogueReady, catalogueAvailable, catalogueError, product, accountReady, cartBusy, checkDelivery, explainError } = usePreview();
  const [pack, setPack] = useState<PackId>("1l");
  const [quantity, setQuantity] = useState(1);
  const [pin, setPin] = useState("");
  const [delivery, setDelivery] = useState<DeliveryCheck | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const actionRef = useRef(false);
  const router = useRouter();
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("pack"); if (["1l", "2l", "5l"].includes(value ?? "")) setPack(value as PackId); }, []);
  useEffect(() => { if (state.variants.length && !state.variants.some(variant => variant.id === pack)) setPack(state.variants[0].id); }, [state.variants, pack]);
  useEffect(() => { setDelivery(null); setDeliveryError(""); }, [pin, pack, quantity]);
  const variant = state.variants.find(variant => variant.id === pack);
  async function purchase(buyNow = false) {
    if (actionRef.current) return;
    actionRef.current = true; setAdding(true);
    try { if (await addPack(pack, quantity)) { if (buyNow) router.push("/checkout"); } }
    finally { actionRef.current = false; setAdding(false); }
  }
  async function check() {
    if (checking) return;
    setChecking(true); setDeliveryError(""); setDelivery(null);
    try { setDelivery(await checkDelivery(pin, [{ id: pack, quantity }])); }
    catch (reason) { setDeliveryError(explainError(reason)); }
    finally { setChecking(false); }
  }
  if (!catalogueReady) return <section className="page-width standard-page"><DataStatus loading={t("Loading oil details…", "నూనె వివరాలు లోడ్ అవుతున్నాయి…")} /></section>;
  if (catalogueError) return <section className="page-width standard-page"><DataStatus error={catalogueError} /></section>;
  if (!catalogueAvailable || !product || !variant) return <section className="page-width standard-page"><EmptyState title={t("This oil pack is unavailable", "ఈ నూనె ప్యాక్ అందుబాటులో లేదు")} description={t("Return to all packs to see what is available.", "అందుబాటులో ఉన్న ప్యాక్‌లను చూడడానికి అన్ని ప్యాక్‌లకు వెళ్లండి.")} action={t("All packs", "అన్ని ప్యాక్‌లు")} /></section>;
  const unavailable = !variant.enabled || variant.stock === 0;
  return <section className="page-width standard-page">
    <Link className="back-link" href="/shop"><ArrowLeft size={17} aria-hidden="true" />{t("All packs", "అన్ని ప్యాక్‌లు")}</Link>
    <div className="product-detail"><div className={"product-detail-art art-" + pack}><ProductArt pack={pack} /><p>{t("Packaging concept", "ప్యాకేజింగ్ నమూనా")}</p></div>
      <div className="product-detail-copy"><h1>{languageText(product.name, state.language)}</h1><p>{languageText(product.description, state.language)}</p>
        <fieldset className="pack-selector" disabled={checking || adding}><legend>{t("Choose your pack", "మీ ప్యాక్ ఎంచుకోండి")}</legend><div>{state.variants.map(variant => <label key={variant.id} className={"pack-option " + (pack === variant.id ? "selected" : "")}>
          <input type="radio" name="pack" value={variant.id} checked={pack === variant.id} onChange={() => { setPack(variant.id); setQuantity(1); }} /><strong>{variant.litres} L</strong><span>{money(variant.pricePaise)}</span>
        </label>)}</div></fieldset>
        <div className="price-stock"><strong>{money(variant.pricePaise)}</strong><span className={"stock-label " + (unavailable ? "unavailable" : "")}><span />{unavailable ? t("Unavailable", "అందుబాటులో లేదు") : mode === "firebase" ? t("In stock", "స్టాక్ ఉంది") : t("Available in preview", "ప్రివ్యూలో అందుబాటులో ఉంది")}</span></div>
        <div className="quantity-row"><span>{t("Quantity", "పరిమాణం")}</span><div className="quantity-control">
          <button aria-label={t("Decrease quantity", "పరిమాణం తగ్గించండి")} disabled={quantity <= 1 || checking || adding} onClick={() => setQuantity(quantity => quantity - 1)}><Minus size={16} /></button><span aria-live="polite">{quantity}</span>
          <button aria-label={t("Increase quantity", "పరిమాణం పెంచండి")} disabled={quantity >= Math.min(variant.stock, 20) || checking || adding} onClick={() => setQuantity(quantity => quantity + 1)}><Plus size={16} /></button>
        </div></div>
        <div className="product-purchase"><button className="button primary" disabled={!ready || !accountReady || unavailable || cartBusy || adding} onClick={() => void purchase()}>{adding ? t("Adding…", "చేరుతోంది…") : t("Add to cart", "కార్ట్‌లో చేర్చండి")}<ShoppingBag size={18} /></button>
          <button className="button secondary" disabled={!ready || !accountReady || unavailable || cartBusy || adding} onClick={() => void purchase(true)}>{t("Buy now", "ఇప్పుడే కొనండి")}<ArrowRight size={18} /></button>
        </div>
        <div className="delivery-check"><label htmlFor="product-pin"><MapPin size={17} />{t("Check delivery to your PIN", "మీ పిన్‌కు డెలివరీ చూడండి")}</label><div>
          <input id="product-pin" inputMode="numeric" maxLength={6} disabled={checking} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ""))} placeholder={mode === "firebase" ? t("Six-digit PIN", "ఆరు అంకెల పిన్") : "e.g. 517001"} />
          <button className="button secondary" disabled={pin.length !== 6 || checking} onClick={() => void check()}>{checking ? t("Checking…", "చూస్తోంది…") : t("Check", "చూడండి")}</button>
        </div>{delivery && <p role="status" className="success-text">{delivery.local ? t("Local delivery", "స్థానిక డెలివరీ") : t("Courier shipping", "కొరియర్ షిప్పింగ్")} · {delivery.estimate} · {money(delivery.feePaise)} {delivery.preview ? t("sample delivery", "నమూనా డెలివరీ") : t("estimated delivery", "డెలివరీ అంచనా")}</p>}
          {deliveryError && <p role="alert" className="error-text">{deliveryError}</p>}
          <p className="small-note">{t("The final delivery fee and total are reviewed at checkout.", "తుది డెలివరీ ఛార్జీ మరియు మొత్తం చెక్అవుట్‌లో చూడవచ్చు.")}</p>
        </div>
      </div>
    </div>
    <div className="product-facts"><div><h2>{t("What is in your pack?", "మీ ప్యాక్‌లో ఏముంది?")}</h2><p>{languageText(product.ingredients, state.language)}</p><h2>{t("Storage", "నిల్వ")}</h2><p>{languageText(product.storage, state.language)}</p></div>
      <div><h2>{t("The Ghani process", "ఘానీ పద్ధతి")}</h2><p>{languageText(product.extraction, state.language)}</p><Link className="text-link" href="/our-ghani">{t("Explore the process", "పద్ధతి చూడండి")}<ArrowRight size={15} /></Link></div>
    </div>
  </section>;
}

export function CartPage() {
  const { state, mode, ready, accountReady, accountError, catalogueReady, catalogueError, t, setQuantity, cartBusy } = usePreview();
  const subtotal = cartSubtotal(state.cart, state.variants);
  const valid = state.cart.every(line => { const variant = state.variants.find(variant => variant.id === line.id); return !!variant?.enabled && line.quantity <= variant.stock; });
  return <section className="page-width standard-page"><PageHeading title={t("Your cart", "మీ కార్ట్")} description={t("A little tradition, ready for your kitchen.", "మీ వంటింటికి సిద్ధంగా ఉన్న సాంప్రదాయం.")} />
    {!ready ? <DataStatus loading={t("Loading your cart…", "కార్ట్ లోడ్ అవుతోంది…")} /> : <>
      {accountError ? <DataStatus error={accountError} /> : !accountReady && <DataStatus loading={t("Synchronizing your saved cart…", "సేవ్ చేసిన కార్ట్ సమకాలీకరణ అవుతోంది…")} />}
      {!catalogueReady ? <DataStatus loading={t("Loading current prices…", "ప్రస్తుత ధరలు లోడ్ అవుతున్నాయి…")} /> : catalogueError && <DataStatus error={catalogueError} />}
      {!state.cart.length && accountReady ? <EmptyState title={t("Your cart is waiting", "మీ కార్ట్ ఖాళీగా ఉంది")} description={t("Choose a pack to begin your first order.", "మొదటి ఆర్డర్ కోసం ఒక ప్యాక్ ఎంచుకోండి.")} action={t("Explore our oil", "మా నూనె చూడండి")} /> : state.cart.length > 0 && <div className="cart-layout"><div className="cart-lines">
        {state.cart.map(line => {
          const variant = state.variants.find(variant => variant.id === line.id);
          const litres = variant?.litres ?? PACK_LITRES[line.id];
          const available = !!variant?.enabled && line.quantity <= variant.stock;
          return <article className="cart-line" key={line.id}><Link href={"/oil/groundnut?pack=" + line.id} className={"cart-line-art art-" + line.id} aria-label={t("View oil pack", "నూనె ప్యాక్ చూడండి") + " " + litres + " L"}><ProductArt pack={line.id} /></Link>
            <div className="cart-line-copy"><h2>{t("Ghani groundnut oil", "ఘానీ వేరుశెనగ నూనె")}</h2><p>{litres} L · {variant ? money(variant.pricePaise) : t("Price unavailable", "ధర అందుబాటులో లేదు")} {t("per pack", "ఒక్క ప్యాక్")}</p>
              <div className="quantity-control"><button disabled={!accountReady || cartBusy} aria-label={t("Decrease pack quantity", "ప్యాక్ పరిమాణం తగ్గించండి") + " " + litres + " L"} onClick={() => void setQuantity(line.id, line.quantity - 1)}><Minus size={15} /></button><span>{line.quantity}</span>
                <button aria-label={t("Increase pack quantity", "ప్యాక్ పరిమాణం పెంచండి") + " " + litres + " L"} disabled={!accountReady || cartBusy || !variant?.enabled || line.quantity >= Math.min(variant?.stock ?? 0, 20)} onClick={() => void setQuantity(line.id, line.quantity + 1)}><Plus size={15} /></button>
              </div>{catalogueReady && !available && <p className="error-text">{t("This quantity is unavailable. Reduce it or remove the pack.", "ఈ పరిమాణం అందుబాటులో లేదు. తగ్గించండి లేదా ప్యాక్ తొలగించండి.")}</p>}
            </div><div className="cart-line-end"><strong>{variant ? money(variant.pricePaise * line.quantity) : "—"}</strong><button className="text-button subtle" disabled={!accountReady || cartBusy} onClick={() => void setQuantity(line.id, 0)} aria-label={t("Remove pack", "ప్యాక్ తొలగించండి") + " " + litres + " L"}><X size={15} />{t("Remove", "తొలగించండి")}</button></div>
          </article>;
        })}
        <Link href="/shop" className="text-link">{t("Continue shopping", "కొనుగోలు కొనసాగించండి")}<ArrowRight size={17} /></Link>
      </div><aside className="order-summary"><h2>{t("Order summary", "ఆర్డర్ సారాంశం")}</h2><div className="summary-row"><span>{t("Items subtotal", "వస్తువుల ఉప మొత్తం")}</span><strong>{catalogueReady && !catalogueError && valid ? money(subtotal) : "—"}</strong></div><div className="summary-row"><span>{t("Delivery", "డెలివరీ")}</span><span>{t("Reviewed at checkout", "చెక్అవుట్‌లో చూడవచ్చు")}</span></div><hr />
        {catalogueReady && !catalogueError && valid && accountReady && !cartBusy ? <Link href="/checkout" className="button primary full-width">{t("Continue to checkout", "చెక్అవుట్‌కు వెళ్లండి")}<ArrowRight size={18} /></Link> : <button className="button primary full-width" disabled>{cartBusy ? t("Updating cart…", "కార్ట్ మారుతోంది…") : t("Review your cart to continue", "కొనసాగించడానికి కార్ట్‌ను సరిచూడండి")}</button>}
        <p className="small-note">{mode === "firebase" ? t("The current pack subtotal is an estimate. Checkout confirms the full total and delivery fee.", "ప్రస్తుత ప్యాక్ ఉప మొత్తం అంచనా. చెక్అవుట్‌లో పూర్తి మొత్తం మరియు డెలివరీ నిర్ధారించబడతాయి.") : t("Sample prices. Your reviewed preview total includes delivery.", "నమూనా ధరలు. ప్రివ్యూ మొత్తంలో డెలివరీ ఉంటుంది.")}</p>
      </aside></div>}
    </>}
  </section>;
}

export function AddressFields({ address, onChange }: { address: Address; onChange: (address: Address) => void }) {
  const { t } = usePreview();
  const set = (key: keyof Address, value: string) => onChange({ ...address, [key]: value });
  return <div className="address-fields"><label>{t("Full name", "పూర్తి పేరు")}<input required minLength={2} maxLength={100} autoComplete="name" value={address.name} onChange={event => set("name", event.target.value)} /></label>
    <label>{t("Mobile number", "మొబైల్ నంబర్")}<input required type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" value={address.phone} onChange={event => set("phone", event.target.value.replace(/\D/g, ""))} /></label>
    <label className="span-two">{t("Street address", "వీధి చిరునామా")}<input required minLength={5} maxLength={300} autoComplete="street-address" value={address.street} onChange={event => set("street", event.target.value)} placeholder={t("House number, street and area", "ఇంటి నంబర్, వీధి మరియు ప్రాంతం")} /></label>
    <label>{t("City / town", "నగరం / పట్టణం")}<input required minLength={2} maxLength={100} autoComplete="address-level2" value={address.city} onChange={event => set("city", event.target.value)} /></label>
    <label>{t("PIN code", "పిన్ కోడ్")}<input required autoComplete="postal-code" inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" value={address.pin} onChange={event => set("pin", event.target.value.replace(/\D/g, ""))} /></label>
  </div>;
}

export function CheckoutPage() {
  const { state, mode, ready, accountReady, accountError, catalogueReady, catalogueAvailable, catalogueError, settings, offline, cartBusy, t, quoteCheckout, placeOrder, explainError } = usePreview();
  const router = useRouter();
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [review, setReview] = useState<CheckoutReview | null>(null);
  const reviewRef = useRef<CheckoutReview | null>(null);
  const [error, setError] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [hydratedAccount, setHydratedAccount] = useState<string | null>(null);
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const busyRef = useRef(false);
  const hydratedUid = useRef<string | null>(null);
  const operation = useRef(0);
  const uid = state.user?.uid ?? null;
  const currentAccount = useRef({ uid, ready, accountReady });
  currentAccount.current = { uid, ready, accountReady };
  const cartSignature = JSON.stringify(state.cart);
  const updateReview = useCallback((next: CheckoutReview | null) => { reviewRef.current = next; setReview(next); }, []);
  useEffect(() => {
    if (!ready || !accountReady || !uid) {
      hydratedUid.current = null; setHydratedAccount(null); updateReview(null); setRecoveryError("");
      operation.current += 1; busyRef.current = false; setBusy(false);
      return;
    }
    if (hydratedUid.current === uid) return;
    operation.current += 1; busyRef.current = false; setBusy(false);
    setError(""); updateReview(null);
    const savedAddress = state.addresses[uid] ?? { ...emptyAddress(), name: state.user!.name, phone: state.user!.phone };
    setAddress(savedAddress);
    try {
      const saved = mode === "demo" ? null : readCheckoutReview(uid, cartSignature, () => sessionStorage);
      if (saved) { setAddress(saved.address); updateReview(saved); }
      hydratedUid.current = uid; setHydratedAccount(uid); setRecoveryError("");
    } catch (reason) { setRecoveryError(explainError(reason)); }
  }, [ready, accountReady, uid, mode, state.addresses, cartSignature, state.user, recoveryVersion, explainError, updateReview]);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  const activeReview = activeCheckoutReview(review, uid, cartSignature, address);
  const quote = activeReview?.quote;
  const expired = !!quote && Date.parse(quote.expiresAt) <= now;
  const stockAvailable = state.cart.every(line => { const variant = state.variants.find(variant => variant.id === line.id); return !!variant?.enabled && line.quantity <= variant.stock; });
  const canReview = !!uid && hydratedAccount === uid && accountReady && !!state.cart.length && !!settings?.orderingEnabled && catalogueReady && catalogueAvailable && stockAvailable && !cartBusy && (mode === "demo" || !offline);
  const canPlace = !!uid && hydratedAccount === uid && accountReady && (activeReview?.attempted ? !cartBusy && (mode === "demo" || !offline) : canReview);
  const subtotal = cartSubtotal(state.cart, state.variants);
  function sameCheckout(requestUid: string, requestOperation: number) {
    return currentAccount.current.uid === requestUid && currentAccount.current.ready && currentAccount.current.accountReady && hydratedUid.current === requestUid && operation.current === requestOperation;
  }
  function retryRecovery() { hydratedUid.current = null; setHydratedAccount(null); setRecoveryError(""); setRecoveryVersion(version => version + 1); }
  function changeAddress(next: Address) {
    if (!canReplaceCheckoutReview(reviewRef.current, uid, busyRef.current)) return;
    setAddress(next); updateReview(null); setError("");
    if (mode !== "demo" && uid) {
      try { removeCheckoutReview(uid, () => sessionStorage); }
      catch (reason) { setError(explainError(reason)); }
    }
  }
  async function requestReview(event: React.FormEvent) {
    event.preventDefault();
    if (!uid || !canReview || !canReplaceCheckoutReview(reviewRef.current, uid, busyRef.current)) return;
    const requestUid = uid;
    const requestOperation = ++operation.current;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const valid = validateAddress(address);
      const quote = await quoteCheckout(valid);
      if (!sameCheckout(requestUid, requestOperation)) return;
      const next: CheckoutReview = { uid: requestUid, quote, key: crypto.randomUUID(), address: valid, cartSignature, attempted: false };
      setAddress(valid);
      updateReview(next);
      if (mode !== "demo") saveCheckoutReview(next, () => sessionStorage);
    } catch (reason) { if (sameCheckout(requestUid, requestOperation)) setError(explainError(reason)); }
    finally { if (sameCheckout(requestUid, requestOperation)) { busyRef.current = false; setBusy(false); } }
  }
  async function submitOrder() {
    const currentReview = activeCheckoutReview(reviewRef.current, uid, cartSignature, address);
    if (!uid || busyRef.current || !canPlace || !currentReview || !currentReview.quote.codAllowed || (Date.parse(currentReview.quote.expiresAt) <= Date.now() && !currentReview.attempted)) return;
    const requestUid = uid;
    const requestOperation = ++operation.current;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const attempt = mode === "demo" ? { ...currentReview, attempted: true } : retainCheckoutAttempt(currentReview, () => sessionStorage);
      updateReview(attempt);
      const id = await placeOrder(attempt.quote, attempt.key);
      if (!sameCheckout(requestUid, requestOperation)) return;
      try { if (mode !== "demo") removeCheckoutReview(requestUid, () => sessionStorage); } catch { /* A retained confirmed-order key remains safe to retry. */ }
      updateReview(null);
      router.push("/order-result/" + id);
    } catch (reason) {
      if (!sameCheckout(requestUid, requestOperation)) return;
      setError(explainError(reason));
      if (["QUOTE_EXPIRED", "QUOTE_CHANGED", "QUOTE_NOT_FOUND", "QUOTE_OWNER_MISMATCH", "IDEMPOTENCY_CONFLICT", "OUT_OF_STOCK", "STORE_NOT_READY", "COD_UNAVAILABLE", "NOT_SERVICEABLE", "INVALID_INPUT"].includes(errorCode(reason))) {
        updateReview(null);
        try { if (mode !== "demo") removeCheckoutReview(requestUid, () => sessionStorage); } catch { /* The server explicitly rejected this attempt; a new review can replace it. */ }
      }
    } finally { if (sameCheckout(requestUid, requestOperation)) { busyRef.current = false; setBusy(false); } }
  }
  return <section className="page-width standard-page"><PageHeading title={t("Make it yours", "మీ కోసం ఆర్డర్ చేయండి")}
    description={mode === "firebase" ? t("Review delivery and the full total before placing your cash-on-delivery order.", "నగదు చెల్లింపు ఆర్డర్ ముందు డెలివరీ మరియు పూర్తి మొత్తం చూడండి.") : t("Check your details and delivery before placing a clearly labelled preview order.", "ప్రివ్యూ ఆర్డర్ ముందు వివరాలు మరియు డెలివరీని సరిచూడండి.")} />
    {!ready ? <DataStatus loading={t("Loading checkout…", "చెక్అవుట్ లోడ్ అవుతోంది…")} /> : !state.user ? <div className="sign-in-prompt"><UserNotice /><Link href="/sign-in?returnTo=/checkout" className="button primary">{t("Sign in to continue", "కొనసాగించడానికి సైన్ ఇన్ చేయండి")}<ArrowRight size={18} /></Link><Link href="/cart" className="text-link">{t("Back to cart", "కార్ట్‌కు తిరిగి వెళ్లండి")}</Link></div>
      : !accountReady ? <DataStatus error={accountError} loading={t("Loading your saved details and cart…", "సేవ్ చేసిన వివరాలు మరియు కార్ట్ లోడ్ అవుతున్నాయి…")} />
      : hydratedAccount !== uid ? <DataStatus error={recoveryError} loading={t("Restoring your checkout…", "మీ చెక్అవుట్‌ను తిరిగి పొందుతున్నాము…")} onRetry={retryRecovery} />
      : !checkoutHasContent(state.cart.length, activeReview) ? <EmptyState title={t("Choose your oil first", "ముందుగా నూనె ఎంచుకోండి")} description={t("Add a pack to your cart to begin checkout.", "చెక్అవుట్ కోసం కార్ట్‌లో ప్యాక్ చేర్చండి.")} />
      : <>{catalogueError && <DataStatus error={catalogueError} />}<form className="checkout-layout" onSubmit={requestReview}>
        <div className="checkout-main"><section className="form-section"><div className="form-section-heading"><h2>{t("Delivery details", "డెలివరీ వివరాలు")}</h2>
          {mode !== "firebase" && <button type="button" disabled={busy || activeReview?.attempted} className="text-button" onClick={() => changeAddress({ name: state.user!.name || "Preview Customer", phone: state.user!.phone, street: "12, Sample Street", city: "Chittoor", pin: "517001" })}>{t("Use sample address", "నమూనా చిరునామా వాడండి")}</button>}
        </div><fieldset disabled={busy || activeReview?.attempted}><AddressFields address={address} onChange={changeAddress} /></fieldset>
          <p className="small-note">{mode === "firebase" ? t("Your order keeps a copy of these delivery details.", "మీ ఆర్డర్‌లో ఈ డెలివరీ వివరాలు సేవ్ అవుతాయి.") : t("Use sample details for preview testing. No delivery is booked.", "ప్రివ్యూ కోసం నమూనా వివరాలు వాడండి. డెలివరీ బుక్ చేయబడదు.")}</p>
        </section><section className="form-section"><h2>{t("Delivery", "డెలివరీ")}</h2>{quote ? <div className="delivery-result"><Truck size={23} /><div><strong>{t("Delivery reviewed for", "ఈ పిన్‌కు డెలివరీ చూశారు")} {address.pin}</strong><p>{quote.estimate} · {money(quote.shippingPaise)} {quote.preview ? t("sample charge", "నమూనా ఛార్జీ") : t("delivery charge", "డెలివరీ ఛార్జీ")}</p></div><Check size={20} /></div>
          : <p className="small-note">{t("Enter your full address, then review the total to check delivery and cash-on-delivery availability.", "పూర్తి చిరునామా నమోదు చేసి మొత్తం చూడండి. డెలివరీ మరియు నగదు చెల్లింపు అర్హత కనిపిస్తాయి.")}</p>}
        </section><fieldset className="form-section payment-options"><legend>{t("Payment", "చెల్లింపు")}</legend>
          <label className={quote && !quote.codAllowed ? "disabled-choice" : ""}><input type="radio" name="payment" checked={true} readOnly disabled={!quote?.codAllowed} /><span><strong>{t("Cash on delivery", "డెలివరీ సమయంలో నగదు")}</strong><small>{quote && !quote.codAllowed ? t("Unavailable for this PIN.", "ఈ పిన్‌కు అందుబాటులో లేదు.") : t("Pay the confirmed total when your order is delivered.", "ఆర్డర్ డెలివరీ సమయంలో నిర్ధారించిన మొత్తం చెల్లించండి.")}</small></span></label>
          <label className="disabled-choice"><input type="radio" name="payment" disabled checked={false} readOnly /><span><strong>{t("Online payment — unavailable", "ఆన్‌లైన్ చెల్లింపు — అందుబాటులో లేదు")}</strong><small>{t("Online payment will appear when the merchant setup is ready.", "వ్యాపార చెల్లింపు వ్యవస్థ సిద్ధమైనప్పుడు ఆన్‌లైన్ చెల్లింపు కనిపిస్తుంది.")}</small></span></label>
        </fieldset>
          {quote && !quote.codAllowed && <p className="error-text" role="status">{t("This PIN does not support cash on delivery. Use another delivery address to continue.", "ఈ పిన్‌కు నగదు చెల్లింపు లేదు. కొనసాగించడానికి మరో చిరునామా వాడండి.")}</p>}
          {!settings?.orderingEnabled && <p className="error-text" role="status">{t("Ordering is currently unavailable. Please check back or contact the business.", "ప్రస్తుతం ఆర్డర్లు అందుబాటులో లేవు. తరువాత చూడండి లేదా వ్యాపారాన్ని సంప్రదించండి.")}</p>}
          {!stockAvailable && !activeReview?.attempted && <p className="error-text" role="alert">{t("A pack quantity changed. Review your cart before continuing.", "ప్యాక్ పరిమాణం మారింది. కొనసాగించే ముందు కార్ట్‌ను సరిచూడండి.")} <Link href="/cart" className="text-link">{t("Review cart", "కార్ట్ చూడండి")}</Link></p>}
          {activeReview?.attempted && <p className="small-note">{t("If your last attempt was interrupted, retry this same order before changing your cart.", "మునుపటి ప్రయత్నం మధ్యలో ఆగితే, కార్ట్ మార్చే ముందు అదే ఆర్డర్ మళ్లీ ప్రయత్నించండి.")}</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
        </div><aside className="order-summary"><h2>{t("Your order", "మీ ఆర్డర్")}</h2>
          {(quote ? quote.lines : state.cart).map(line => {
            const snapshot = quote?.lines.find(snapshot => snapshot.id === line.id);
            const variant = state.variants.find(variant => variant.id === line.id);
            return <div key={line.id} className="summary-row"><span>{snapshot?.litres ?? variant?.litres ?? PACK_LITRES[line.id]} L × {line.quantity}</span><strong>{snapshot ? money(snapshot.unitPricePaise * line.quantity) : variant ? money(variant.pricePaise * line.quantity) : "—"}</strong></div>;
          })}<hr />
          <div className="summary-row"><span>{t("Subtotal", "ఉప మొత్తం")}</span><span>{quote ? money(quote.subtotalPaise) : catalogueReady ? money(subtotal) : "—"}</span></div>
          <div className="summary-row"><span>{t("Delivery", "డెలివరీ")}</span><span>{quote ? money(quote.shippingPaise) : t("Review to confirm", "నిర్ధారించడానికి చూడండి")}</span></div>
          <div className="summary-row total"><span>{t("Total", "మొత్తం")}</span><strong>{quote ? money(quote.totalPaise) : "—"}</strong></div>
          {quote && <p className="small-note">{expired ? t("This reviewed total has expired.", "ఈ మొత్తం గడువు ముగిసింది.") : t("This reviewed total is valid until", "ఈ మొత్తం గడువు")} {!expired && new Intl.DateTimeFormat(state.language === "te" ? "te-IN" : "en-IN", { timeStyle: "short" }).format(new Date(quote.expiresAt))}</p>}
          {quote && quote.codAllowed && (!expired || activeReview?.attempted) ? <button className="button primary full-width" disabled={busy || !canPlace} type="button" onClick={() => void submitOrder()}>{busy ? t("Saving order…", "ఆర్డర్ సేవ్ అవుతోంది…") : activeReview?.attempted ? t("Retry order", "ఆర్డర్ మళ్లీ ప్రయత్నించండి") : quote.preview ? t("Place preview COD order", "ప్రివ్యూ నగదు ఆర్డర్ చేయండి") : t("Place cash-on-delivery order", "నగదు చెల్లింపు ఆర్డర్ చేయండి")}<ArrowRight size={18} /></button>
            : <button className="button primary full-width" disabled={busy || !canReview} type="submit">{busy ? t("Reviewing total…", "మొత్తం చూస్తోంది…") : t("Review delivery & total", "డెలివరీ మరియు మొత్తం చూడండి")}<ArrowRight size={18} /></button>}
          {quote && !activeReview?.attempted && !busy && <button type="submit" className="text-button" disabled={!canReview}>{t("Review a new total", "కొత్త మొత్తం చూడండి")}</button>}
          <p className="small-note">{mode === "firebase" ? t("Your order is created only after you confirm the reviewed total. Payment is collected on delivery.", "మీరు మొత్తం నిర్ధారించిన తరువాతే ఆర్డర్ సృష్టించబడుతుంది. డెలివరీ సమయంలో చెల్లించండి.") : t("Preview order only. No money is charged and no delivery is booked.", "ప్రివ్యూ ఆర్డర్ మాత్రమే. డబ్బు చార్జ్ చేయబడదు, డెలివరీ బుక్ చేయబడదు.")}</p>
          <Link href="/policies/returns" className="small-link">{t("Returns & refunds", "రిటర్న్స్ మరియు రీఫండ్స్")}</Link>
        </aside>
      </form></>}
  </section>;
}

function UserNotice() {
  const { mode, t } = usePreview();
  return <><h2>{t("Keep your orders in one place", "మీ ఆర్డర్లను ఒకే చోట ఉంచండి")}</h2><p>{mode === "demo" ? t("Try a demo account to see order history and the welcome guide. No OTP is sent in this preview.", "ఆర్డర్ చరిత్ర మరియు స్వాగత గైడ్ కోసం డెమో ఖాతా ప్రయత్నించండి. ఈ ప్రివ్యూలో OTP పంపబడదు.") : t("Verify your mobile number to save your address, follow your orders and continue checkout.", "చిరునామా సేవ్ చేయడానికి, ఆర్డర్లు ట్రాక్ చేయడానికి మరియు చెక్అవుట్ కోసం మొబైల్ నంబర్ ధృవీకరించండి.")}</p></>;
}
