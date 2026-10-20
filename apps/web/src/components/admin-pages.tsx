"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Check, ClipboardList, Package, Settings2, ShoppingBag } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { money, type DemoOrder, type Variant } from "@/lib/demo";
import { languageText } from "@/lib/commerce";
import { usePreview } from "./preview-provider";
import { statusLabel, useOrderRecord } from "./account-pages";
import { DataStatus, ConnectionBanner } from "./data-status";

function VariantEditor({ variant, inventoryOnly = false }: { variant: Variant; inventoryOnly?: boolean }) {
  const { mode, t, updateVariant, explainError, offline } = usePreview();
  const [price, setPrice] = useState(String(variant.pricePaise / 100));
  const [stock, setStock] = useState(String(variant.stock));
  const [enabled, setEnabled] = useState(variant.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await updateVariant({ ...variant, pricePaise: inventoryOnly ? variant.pricePaise : Math.round(Number(price) * 100), stock: Number(stock), enabled }); }
    catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }
  return <form className="catalogue-editor-row" onSubmit={event => void save(event)} aria-busy={busy}>
    <div><strong>{t("Ghani groundnut oil", "ఘానీ వేరుశెనగ నూనె")}</strong><span>{variant.litres} {t("litre pack", "లీటర్ల ప్యాక్")}</span></div>
    {!inventoryOnly && <label>{mode === "firebase" ? t("Price (₹)", "ధర (₹)") : t("Sample price (₹)", "నమూనా ధర (₹)")}<input required disabled={busy} type="number" min="1" max="10000" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /></label>}
    <label>{mode === "firebase" ? t("Available packs", "అందుబాటులో ప్యాక్‌లు") : t("Available sample packs", "నమూనా ప్యాక్‌లు")}<input required disabled={busy} type="number" min="0" max="100000" step="1" value={stock} onChange={event => setStock(event.target.value)} /></label>
    <label className="checkbox-control"><input type="checkbox" disabled={busy} checked={enabled} onChange={event => setEnabled(event.target.checked)} />{t("Available to order", "ఆర్డర్‌కు అందుబాటులో")}</label>
    <button className="button primary" disabled={busy || (mode !== "demo" && offline)} type="submit">{busy ? t("Saving…", "సేవ్ అవుతోంది…") : t("Save", "సేవ్ చేయండి")}<Check size={16} /></button>
    {error && <p className="error-text editor-error" role="alert">{error}</p>}
  </form>;
}

function OrderStatusEditor({ order }: { order: DemoOrder }) {
  const { mode, t, updateOrder, explainError, offline } = usePreview();
  const [status, setStatus] = useState(order.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next: Record<DemoOrder["status"], DemoOrder["status"][]> = { received: ["packed", "cancelled"], packed: ["shipped", "cancelled"], shipped: ["delivered"], delivered: [], cancelled: [] };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || status === order.status) return;
    setBusy(true); setError("");
    try { await updateOrder(order.id, status); }
    catch (reason) { setError(explainError(reason)); }
    finally { setBusy(false); }
  }
  return <form className="order-summary" onSubmit={event => void save(event)} aria-busy={busy}><h2>{order.preview ? t("Preview status", "ప్రివ్యూ స్థితి") : t("Order status", "ఆర్డర్ స్థితి")}</h2>
    <label>{t("Order stage", "ఆర్డర్ దశ")}<select disabled={busy || next[order.status].length === 0} value={status} onChange={event => setStatus(event.target.value as DemoOrder["status"])}>{[order.status, ...next[order.status]].map(stage => <option key={stage} value={stage}>{statusLabel(stage, t)}</option>)}</select></label>
    <p className="small-note">{status === "cancelled" ? t("Cancellation restores the ordered packs to available stock. Shipped orders cannot be cancelled here.", "రద్దు చేసినప్పుడు ప్యాక్‌లు స్టాక్‌కు తిరిగి చేరుతాయి. పంపిన ఆర్డర్లు ఇక్కడ రద్దు చేయలేరు.") : t("The customer sees the saved stage on their order page. COD is collected when marked delivered.", "సేవ్ చేసిన స్థితి కస్టమర్‌కు కనిపిస్తుంది. డెలివరీ అయిందని చూపినప్పుడు నగదు చెల్లింపు తీసుకోబడుతుంది.")}</p>
    {error && <p className="error-text" role="alert">{error}</p>}
    <button className="button primary full-width" disabled={busy || status === order.status || (mode !== "demo" && offline)} type="submit">{busy ? t("Saving status…", "స్థితి సేవ్ అవుతోంది…") : status === "cancelled" ? t("Cancel order", "ఆర్డర్ రద్దు చేయండి") : t("Save status", "స్థితి సేవ్ చేయండి")}<Check size={16} /></button>
    <hr /><div className="summary-row"><span>{t("Subtotal", "ఉప మొత్తం")}</span><strong>{money(order.subtotalPaise)}</strong></div><div className="summary-row"><span>{t("Delivery", "డెలివరీ")}</span><strong>{money(order.shippingPaise)}</strong></div><div className="summary-row total"><span>{t("Total", "మొత్తం")}</span><strong>{money(order.totalPaise)}</strong></div>
  </form>;
}

export function AdminPage() {
  const { state, mode, ready, accountReady, accountError, catalogueReady, catalogueError, ownerOrders, ownerOrdersReady, ownerError, product, settings, t, logout, toggleLanguage, explainError } = usePreview();
  const path = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const detailId = path.startsWith("/admin/orders/") ? path.split("/").at(-1) : undefined;
  const { order, loading: orderLoading, error: orderError } = useOrderRecord(detailId, true);
  const authorized = mode === "demo" || state.user?.admin === true;
  const links = [["/admin", t("Overview", "అవలోకనం"), BarChart3], ["/admin/orders", t("Orders", "ఆర్డర్లు"), ClipboardList], ["/admin/catalogue", t("Catalogue", "కేటలాగ్"), ShoppingBag], ["/admin/inventory", t("Inventory", "స్టాక్"), Package]] as const;
  async function switchAccount() {
    setSwitching(true); setSwitchError("");
    try { await logout(); router.push("/sign-in?returnTo=/admin"); }
    catch (reason) { setSwitchError(explainError(reason)); setSwitching(false); }
  }
  if (!ready || (mode !== "demo" && state.user && !accountReady)) return <main className="page-width standard-page"><DataStatus error={accountError} loading={t("Loading owner access…", "యజమాని అనుమతి లోడ్ అవుతోంది…")} />{ready && state.user && accountError && <button className="button secondary" disabled={switching} onClick={() => void switchAccount()}>{t("Use another account", "మరో ఖాతా వాడండి")}<ArrowRight size={18} /></button>}{switchError && <p className="error-text" role="alert">{switchError}</p>}</main>;
  if (!authorized) return <main className="page-width standard-page narrow-page"><Link className="wordmark" href="/"><BrandLogo decorative /></Link><div className="page-heading owner-access-heading"><h1>{t("Owner access", "యజమాని అనుమతి")}</h1>
    <p>{state.user ? t("This account does not have access to manage the store. Sign in with the owner's mobile number.", "ఈ ఖాతాకు స్టోర్ నిర్వహణ అనుమతి లేదు. యజమాని మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి.") : t("Sign in with the owner's mobile number to manage catalogue and orders.", "కేటలాగ్ మరియు ఆర్డర్ల నిర్వహణ కోసం యజమాని మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి.")}</p>
  </div>{state.user ? <button className="button primary" disabled={switching} onClick={() => void switchAccount()}>{switching ? t("Signing out…", "సైన్ అవుట్ అవుతోంది…") : t("Use another account", "మరో ఖాతా వాడండి")}<ArrowRight size={18} /></button> : <Link className="button primary" href="/sign-in?returnTo=/admin">{t("Owner sign-in", "యజమాని సైన్ ఇన్")}<ArrowRight size={18} /></Link>}
    {switchError && <p className="error-text" role="alert">{switchError}</p>}<p><Link href="/" className="back-link"><ArrowLeft size={16} />{t("Return to storefront", "స్టోర్‌కు తిరిగి వెళ్లండి")}</Link></p>
  </main>;

  const collected = ownerOrders.filter(order => !order.preview && order.paymentStatus === "collected").reduce((sum, order) => sum + order.totalPaise, 0);
  const orderTotal = ownerOrders.filter(order => order.status !== "cancelled").reduce((sum, order) => sum + order.totalPaise, 0);
  function orderTable(orders: DemoOrder[]) {
    if (!ownerOrdersReady) return <DataStatus loading={t("Loading orders…", "ఆర్డర్లు లోడ్ అవుతున్నాయి…")} />;
    if (ownerError) return <DataStatus error={ownerError} />;
    return <div className="table-wrap"><table><thead><tr><th>{t("Order", "ఆర్డర్")}</th><th>{t("Customer", "కస్టమర్")}</th><th>{t("Packs", "ప్యాక్‌లు")}</th><th>{t("Total", "మొత్తం")}</th><th>{t("Status", "స్థితి")}</th><th>{t("Details", "వివరాలు")}</th></tr></thead>
      <tbody>{orders.length ? orders.map(order => <tr key={order.id}><td><span className="order-id">{order.id}</span>{order.preview && <small className="preview-order-label">{t("Preview order", "ప్రివ్యూ ఆర్డర్")}</small>}</td><td>{order.address.name}</td><td>{order.lines.map(line => line.litres + " L × " + line.quantity).join(", ")}</td><td>{money(order.totalPaise)}</td><td><span className="status-badge">{statusLabel(order.status, t)}</span></td><td><Link className="text-link" href={"/admin/orders/" + order.id}>{t("Open", "తెరవండి")}<ArrowRight size={15} /></Link></td></tr>)
        : <tr><td colSpan={6}>{mode === "firebase" ? t("No orders yet. New customer orders will appear here.", "ఇంకా ఆర్డర్లు లేవు. కొత్త కస్టమర్ ఆర్డర్లు ఇక్కడ కనిపిస్తాయి.") : t("No preview orders yet. Place one from the storefront to see it here.", "ఇంకా ప్రివ్యూ ఆర్డర్లు లేవు. స్టోర్‌లో ఒకటి చేయండి.")}</td></tr>}</tbody>
    </table></div>;
  }
  let content;
  if (path === "/admin" || path === "/admin/sign-in") content = <><div className="admin-heading"><h1>{t("A clear view of your store.", "మీ స్టోర్‌పై స్పష్టమైన దృష్టి.")}</h1><p>{mode === "firebase" ? t("Manage current pack prices, available stock and customer orders.", "ప్రస్తుత ప్యాక్ ధరలు, స్టాక్ మరియు కస్టమర్ ఆర్డర్లు నిర్వహించండి.") : t("Manage the sample catalogue and clearly labelled preview orders.", "నమూనా కేటలాగ్ మరియు ప్రివ్యూ ఆర్డర్లు నిర్వహించండి.")}</p></div>
    <div className="admin-stats"><div><span>{mode === "firebase" ? t("Recent orders", "ఇటీవలి ఆర్డర్లు") : t("Preview orders", "ప్రివ్యూ ఆర్డర్లు")}</span><strong>{ownerOrdersReady ? ownerOrders.length : "—"}</strong></div><div><span>{mode === "firebase" ? t("COD collected · recent orders", "తీసుకున్న నగదు · ఇటీవలి ఆర్డర్లు") : t("Sample order total", "నమూనా ఆర్డర్ల మొత్తం")}</span><strong>{ownerOrdersReady ? money(mode === "firebase" ? collected : orderTotal) : "—"}</strong></div><div><span>{t("Available packs", "అందుబాటులో ప్యాక్‌లు")}</span><strong>{catalogueReady ? state.variants.filter(variant => variant.enabled).reduce((sum, variant) => sum + variant.stock, 0) : "—"}</strong></div></div>
    <div className="admin-section-heading"><h2>{t("Recent orders", "ఇటీవలి ఆర్డర్లు")}</h2><Link href="/admin/orders" className="text-link">{t("All orders", "అన్ని ఆర్డర్లు")}<ArrowRight size={16} /></Link></div>{orderTable(ownerOrders.slice(0, 5))}
    <div className="admin-note"><strong>{mode === "firebase" ? t("Current store activity", "ప్రస్తుత స్టోర్ కార్యకలాపాలు") : t("Owner preview", "యజమాని ప్రివ్యూ")}</strong><p>{mode === "firebase" ? t("The dashboard shows the latest 100 orders. Order totals are purchase snapshots; stock counts packs. Online payment is unavailable.", "డాష్‌బోర్డ్‌లో తాజా 100 ఆర్డర్లు కనిపిస్తాయి. ఆర్డర్ మొత్తాలు కొనుగోలు సమయానివి; స్టాక్ ప్యాక్‌లలో ఉంటుంది. ఆన్‌లైన్ చెల్లింపు లేదు.") : mode === "emulator" ? t("Changes are shared with the local preview app and website. Sample orders do not collect money or book deliveries.", "మార్పులు స్థానిక ప్రివ్యూ యాప్ మరియు వెబ్‌సైట్‌లో కనిపిస్తాయి. నమూనా ఆర్డర్లకు డబ్బు లేదా డెలివరీ ఉండదు.") : t("Changes affect this browser's sample storefront. Sample orders do not collect money or book deliveries.", "మార్పులు ఈ బ్రౌజర్ నమూనా స్టోర్‌ను ప్రభావితం చేస్తాయి. నమూనా ఆర్డర్లకు డబ్బు లేదా డెలివరీ ఉండదు.")}</p></div>
  </>;
  else if (path === "/admin/orders") content = <><div className="admin-heading"><h1>{t("Orders", "ఆర్డర్లు")}</h1><p>{mode === "firebase" ? t("The latest 100 customer orders, newest first.", "తాజా 100 కస్టమర్ ఆర్డర్లు, కొత్తవి మొదట.") : t("Clearly labelled preview orders from the sample storefront.", "నమూనా స్టోర్ నుంచి ప్రివ్యూ ఆర్డర్లు.")}</p></div>{orderTable(ownerOrders)}</>;
  else if (detailId) content = orderError ? <DataStatus error={orderError} /> : orderLoading && !order ? <DataStatus loading={t("Loading order details…", "ఆర్డర్ వివరాలు లోడ్ అవుతున్నాయి…")} /> : order ? <><Link href="/admin/orders" className="back-link"><ArrowLeft size={16} />{t("All orders", "అన్ని ఆర్డర్లు")}</Link>
    <div className="admin-heading"><h1>{order.preview ? t("Preview order details", "ప్రివ్యూ ఆర్డర్ వివరాలు") : t("Order details", "ఆర్డర్ వివరాలు")}</h1><p>{order.id} · {new Intl.DateTimeFormat(state.language === "te" ? "te-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(order.createdAt))}</p></div>
    <div className="admin-order-layout"><div><h2>{order.address.name}</h2><p>{order.address.street}<br />{order.address.city} — {order.address.pin}<br />+91 {order.address.phone}</p><h2>{t("Packs", "ప్యాక్‌లు")}</h2>{order.lines.map(line => <div key={line.id} className="summary-row"><span>{line.litres} L × {line.quantity}</span><strong>{money(line.unitPricePaise * line.quantity)}</strong></div>)}
      <h2>{t("Payment", "చెల్లింపు")}</h2><p>{order.preview ? t("Preview COD — no real money collected.", "ప్రివ్యూ నగదు చెల్లింపు — అసలు డబ్బు తీసుకోబడలేదు.") : order.paymentStatus === "collected" ? t("COD payment collected on delivery.", "డెలివరీ సమయంలో నగదు తీసుకోబడింది.") : order.paymentStatus === "cancelled" ? t("Cancelled — no COD payment due.", "రద్దయింది — నగదు చెల్లింపు అవసరం లేదు.") : t("Cash on delivery — payment remains due.", "డెలివరీ సమయంలో నగదు — చెల్లింపు రావాలి.")}</p>
      <p className="small-note">{t("Placed from", "ఆర్డర్ చేసినది")} {order.channel === "web" ? t("website", "వెబ్‌సైట్") : t("Android app", "ఆండ్రాయిడ్ యాప్")}</p>
    </div><OrderStatusEditor key={order.id + "-" + order.status} order={order} /></div>
  </> : <div className="admin-heading"><h1>{t("Order not found", "ఆర్డర్ కనిపించలేదు")}</h1><p>{t("Return to the orders list.", "ఆర్డర్ల జాబితాకు వెళ్లండి.")}</p><Link className="button secondary" href="/admin/orders">{t("All orders", "అన్ని ఆర్డర్లు")}</Link></div>;
  else if (path === "/admin/catalogue" || path === "/admin/inventory") content = <><div className="admin-heading"><h1>{path === "/admin/inventory" ? t("Inventory", "స్టాక్") : t("Catalogue", "కేటలాగ్")}</h1><p>{mode === "firebase" ? t("Save current pack availability and stock. Catalogue prices are in rupees; orders retain their purchase-time price.", "ప్రస్తుత ప్యాక్ అందుబాటు మరియు స్టాక్ సేవ్ చేయండి. ధరలు రూపాయల్లో ఉన్నాయి; ఆర్డర్లలో కొనుగోలు సమయం ధర ఉంటుంది.") : t("Update sample values shared by this preview. Prices and stock remain illustrative.", "ప్రివ్యూలో నమూనా విలువలు మార్చండి. ధరలు మరియు స్టాక్ నమూనా మాత్రమే.")}</p></div>
    {!catalogueReady ? <DataStatus loading={t("Loading catalogue…", "కేటలాగ్ లోడ్ అవుతోంది…")} /> : catalogueError ? <DataStatus error={catalogueError} /> : <div className="catalogue-editors">{state.variants.map(variant => <VariantEditor key={variant.id + "-" + variant.pricePaise + "-" + variant.stock + "-" + variant.enabled} variant={variant} inventoryOnly={path === "/admin/inventory"} />)}</div>}
  </>;
  else if (path === "/admin/content" && product) content = <><div className="admin-heading"><h1>{t("Published product details", "ప్రచురించిన ఉత్పత్తి వివరాలు")}</h1><p>{t("The current customer-facing product information.", "ప్రస్తుతం కస్టమర్‌కు కనిపించే ఉత్పత్తి సమాచారం.")}</p></div><div className="reading-content"><h2>{languageText(product.name, state.language)}</h2><p>{languageText(product.description, state.language)}</p><h2>{t("Ingredients", "పదార్థాలు")}</h2><p>{languageText(product.ingredients, state.language)}</p><h2>{t("Extraction", "తయారీ")}</h2><p>{languageText(product.extraction, state.language)}</p><h2>{t("Storage", "నిల్వ")}</h2><p>{languageText(product.storage, state.language)}</p></div></>;
  else if (path === "/admin/settings") content = <><div className="admin-heading"><h1>{t("Store settings", "స్టోర్ సెట్టింగ్‌లు")}</h1><p>{t("Current ordering availability.", "ప్రస్తుత ఆర్డర్ అందుబాటు.")}</p></div><div className="detail-block"><div className="summary-row"><span>{t("Ordering", "ఆర్డర్లు")}</span><strong>{settings?.orderingEnabled ? t("Enabled", "అందుబాటులో ఉంది") : t("Unavailable", "అందుబాటులో లేదు")}</strong></div><div className="summary-row"><span>{t("Online payment", "ఆన్‌లైన్ చెల్లింపు")}</span><strong>{t("Unavailable", "అందుబాటులో లేదు")}</strong></div></div></>;
  else content = <div className="admin-heading"><Settings2 size={30} /><h1>{t("This management section is unavailable.", "ఈ నిర్వహణ విభాగం అందుబాటులో లేదు.")}</h1><p>{t("Use catalogue, inventory and orders for the current store operations.", "ప్రస్తుత స్టోర్ నిర్వహణ కోసం కేటలాగ్, స్టాక్ మరియు ఆర్డర్లు వాడండి.")}</p><Link href="/admin" className="button primary">{t("Return to overview", "అవలోకనానికి వెళ్లండి")}<ArrowRight size={18} /></Link></div>;
  return <div className="admin-app"><aside className="admin-sidebar"><Link className="wordmark" href="/" aria-label="Narayana Naturals home"><BrandLogo decorative /></Link><p>{mode === "firebase" ? t("Owner dashboard", "యజమాని డాష్‌బోర్డ్") : t("Owner preview", "యజమాని ప్రివ్యూ")}</p><nav aria-label={t("Owner navigation", "యజమాని నావిగేషన్")}>{links.map(([href, label, Icon]) => <Link className={path === href || href === "/admin/orders" && path.startsWith("/admin/orders/") ? "active" : ""} href={href} key={href}><Icon size={20} />{label}</Link>)}</nav><Link className="admin-store-link" href="/"><ArrowLeft size={17} />{t("View storefront", "స్టోర్ చూడండి")}</Link></aside>
    <div className="admin-main"><ConnectionBanner /><div className="admin-topbar"><span>{mode === "firebase" ? t("Owner dashboard", "యజమాని డాష్‌బోర్డ్") : mode === "emulator" ? t("EMULATOR PREVIEW · Sample orders only", "ఎమ్యులేటర్ ప్రివ్యూ · నమూనా ఆర్డర్లు మాత్రమే") : t("LOCAL DEMO · Sample orders only", "స్థానిక డెమో · నమూనా ఆర్డర్లు మాత్రమే")}</span><div className="admin-account-actions"><button className="language-button" onClick={() => void toggleLanguage()}>{state.language === "en" ? "తెలుగు" : "English"}</button><Link href="/account">{t("Account", "ఖాతా")}<span className="small-avatar">NN</span></Link></div></div>
      <main className="admin-content">{accountError && <DataStatus error={accountError} />}{content}</main>
    </div>
  </div>;
}
