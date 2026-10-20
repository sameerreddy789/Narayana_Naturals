"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, HelpCircle, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { guidePageKey, usePreview } from "./preview-provider";
import { languageText } from "@/lib/commerce";
import { ConnectionBanner } from "./data-status";
import { CartPage, CheckoutPage, HomePage, ProductPage, ShopPage } from "./shopping-pages";
import { AccountPage, AddressesPage, OrderDetailPage, OrdersPage, SignInPage } from "./account-pages";
import { InfoPage } from "./info-pages";
import { AdminPage } from "./admin-pages";

const pageGuides: Record<string, [string, string]> = {
  "/": ["Start with Shop oil to choose a pack. Your cart and account are always available in the header.", "ప్యాక్ ఎంచుకోవడానికి నూనె కొనండి ప్రారంభించండి. కార్ట్ మరియు ఖాతా ఎల్లప్పుడూ పైన అందుబాటులో ఉంటాయి."],
  "/shop": ["Compare 1, 2 and 5 litre packs. Add a pack here, or open its details to choose a quantity.", "1, 2 మరియు 5 లీటర్ల ప్యాక్‌లను చూడండి. ఇక్కడ చేర్చండి లేదా వివరాలలో పరిమాణం ఎంచుకోండి."],
  "/oil/groundnut": ["Choose your pack and quantity, then add it to your cart. Check delivery to your PIN before checkout.", "ప్యాక్ మరియు పరిమాణం ఎంచుకుని కార్ట్‌లో చేర్చండి. చెక్అవుట్ ముందు మీ పిన్‌కు డెలివరీ చూడండి."],
  "/cart": ["Change quantities or remove a pack here. Delivery is calculated when you enter your PIN at checkout.", "ఇక్కడ పరిమాణాలను మార్చండి లేదా ప్యాక్ తొలగించండి. చెక్అవుట్‌లో పిన్ నమోదు చేసిన తర్వాత డెలివరీ లెక్కించబడుతుంది."],
  "/checkout": ["Review your address, delivery charge and full total, then confirm your cash-on-delivery order.", "చిరునామా, డెలివరీ ఛార్జీ మరియు మొత్తం చూసి నగదు చెల్లింపు ఆర్డర్ నిర్ధారించండి."],
  "/account": ["Find your addresses and orders here. You can change language, sign out or replay this guide.", "చిరునామాలు మరియు ఆర్డర్లు ఇక్కడ చూడండి. భాష మార్చండి, సైన్ అవుట్ చేయండి లేదా గైడ్‌ను మళ్లీ చూడండి."],
  "/account/addresses": ["Save your default delivery address to make your next checkout quicker.", "తదుపరి చెక్అవుట్ కోసం మీ సాధారణ డెలివరీ చిరునామాను సేవ్ చేయండి."],
  "/account/orders": ["Your orders appear here. Open an order to see its status or buy those packs again.", "ఆర్డర్లు ఇక్కడ కనిపిస్తాయి. స్థితి చూడడానికి లేదా మళ్లీ కొనడానికి ఆర్డర్ తెరవండి."],
  "/our-ghani": ["Read about the bull-driven wooden Ghani at the heart of Narayana Naturals.", "నారాయణ నేచురల్స్ ఎద్దుల సాయంతో నడిచే చెక్క ఘానీ గురించి చదవండి."],
  "/delivery": ["Check delivery for your exact PIN. Checkout reviews the full delivery fee before you order.", "మీ పిన్‌కు డెలివరీ చూడండి. ఆర్డర్ ముందు చెక్అవుట్‌లో పూర్తి డెలివరీ ఛార్జీ చూడవచ్చు."],
  "/faq": ["Open a question for help with packs, ordering, payments or delivery.", "ప్యాక్‌లు, ఆర్డర్లు, చెల్లింపులు లేదా డెలివరీ సహాయం కోసం ప్రశ్న తెరవండి."],
  "/contact": ["Find the business's available support details here.", "వ్యాపార కస్టమర్ సహాయ వివరాలు ఇక్కడ చూడండి."],
};

function GuideTip() {
  const { state, ready, accountReady, guideBusy, t, dismissTip, skipGuide } = usePreview();
  const pathname = usePathname();
  const uid = state.user?.uid;
  if (!ready || !accountReady || !uid || !state.welcomeSeen.includes(uid)) return null;
  const dismissed = state.dismissedTips[uid] ?? [];
  if (dismissed.includes("__skipped__") || dismissed.includes(guidePageKey(pathname))) return null;
  const guide = pageGuides[pathname] ?? (pathname.startsWith("/policies/") ? ["Read this policy draft. Final business details and policies will be added before the store launches.", "ఈ పాలసీ డ్రాఫ్ట్ చదవండి. స్టోర్ ప్రారంభానికి ముందు తుది వివరాలు చేర్చబడతాయి."] : pathname.startsWith("/order-result/") || pathname.startsWith("/account/orders/") ? ["See your order, payment type and delivery status. You can return to all orders from this page.", "ఆర్డర్, చెల్లింపు రకం మరియు డెలివరీ స్థితి చూడండి. ఇక్కడి నుంచి అన్ని ఆర్డర్లకు వెళ్లవచ్చు."] : null);
  if (!guide) return null;
  return <aside className="page-width guide-tip" aria-label={t("Page guide", "పేజీ గైడ్")}><HelpCircle size={21} aria-hidden="true" /><p>{t(guide[0], guide[1])}</p><div><button disabled={guideBusy} onClick={() => void dismissTip(pathname)} className="text-button">{t("Got it", "అర్థమైంది")}<Check size={15} /></button><button disabled={guideBusy} onClick={() => void skipGuide()} className="text-button subtle">{t("Hide guide", "గైడ్ దాచండి")}</button></div></aside>;
}

function Header() {
  const { state, mode, settings, t, toggleLanguage } = usePreview();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  useEffect(() => setOpen(false), [pathname]);
  const links = [["/shop", "Shop oil", "నూనె కొనండి"], ["/our-ghani", "Our Ghani", "మా ఘానీ"], ["/delivery", "Delivery", "డెలివరీ"], ["/faq", "Help", "సహాయం"]];
  return <>
    <div className="demo-banner">{mode === "demo" ? t("Local preview · Sample prices and delivery fees · Demo orders only", "స్థానిక ప్రివ్యూ · నమూనా ధరలు మరియు డెలివరీ ఛార్జీలు · డెమో ఆర్డర్లు మాత్రమే") : mode === "emulator" ? t("Shared local preview · Sample catalogue & COD orders · No real delivery", "స్థానిక ప్రివ్యూ · నమూనా కేటలాగ్ మరియు నగదు ఆర్డర్లు · అసలు డెలివరీ లేదు") : settings?.notice ? languageText(settings.notice, state.language) : settings?.orderingEnabled ? t("Ghani groundnut oil · Cash on delivery for eligible PIN codes", "ఘానీ వేరుశెనగ నూనె · అర్హమైన పిన్‌లకు నగదు చెల్లింపు") : t("Ordering is currently unavailable", "ప్రస్తుతం ఆర్డర్లు అందుబాటులో లేవు")}</div>
    <header className="site-header"><div className="header-inner page-width">
      <Link className="wordmark" href="/" aria-label="Narayana Naturals home"><BrandLogo decorative /></Link>
      <nav className="desktop-nav" aria-label={t("Main navigation", "ప్రధాన నావిగేషన్")}>{links.map(([href, en, te]) => <Link className={pathname === href ? "active" : ""} key={href} href={href}>{t(en, te)}</Link>)}</nav>
      <div className="header-actions"><button className="language-button" onClick={() => void toggleLanguage()} aria-label={t("Switch to Telugu", "ఆంగ్లానికి మార్చండి")}>{state.language === "en" ? "తెలుగు" : "English"}</button><Link className="account-link" href={state.user ? "/account" : "/sign-in"}><UserRound size={21} /><span>{state.user ? t("Account", "ఖాతా") : t("Sign in", "సైన్ ఇన్")}</span></Link><Link className="cart-link" href="/cart" aria-label={`${t("Cart", "కార్ట్")}, ${count} ${t("items", "వస్తువులు")}`}><ShoppingBag size={22} /><span className="cart-count">{count}</span></Link><button className="icon-button menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={t("Toggle menu", "మెనూ తెరవండి")}>{open ? <X size={23} /> : <Menu size={23} />}</button></div>
    </div>{open && <nav id="mobile-navigation" className="mobile-nav page-width" aria-label={t("Mobile navigation", "మొబైల్ నావిగేషన్")}>
      {links.map(([href, en, te]) => <Link key={href} href={href}>{t(en, te)}</Link>)}
      <Link href={state.user ? "/account" : "/sign-in"}>{state.user ? t("Account", "ఖాతా") : t("Sign in", "సైన్ ఇన్")}</Link>
      <Link href="/account/orders">{t("Your orders", "మీ ఆర్డర్లు")}</Link>
    </nav>}</header>
  </>;
}

function Footer() {
  const { mode, t } = usePreview();
  return <footer className="site-footer"><div className="page-width footer-main"><div><Link href="/" className="footer-brand" aria-label="Narayana Naturals home"><BrandLogo variant="stacked" decorative /></Link><p>{t("Traditional Ghani groundnut oil. From our Ghani to your kitchen.", "సాంప్రదాయ ఘానీ వేరుశెనగ నూనె. మా ఘానీ నుంచి మీ వంటింటికి.")}</p></div><div><strong>{t("Explore", "చూడండి")}</strong><Link href="/shop">{t("Shop oil", "నూనె కొనండి")}</Link><Link href="/our-ghani">{t("Our Ghani", "మా ఘానీ")}</Link><Link href="/delivery">{t("Delivery", "డెలివరీ")}</Link></div><div><strong>{t("Here to help", "సహాయం")}</strong><Link href="/faq">{t("Common questions", "సాధారణ ప్రశ్నలు")}</Link><Link href="/contact">{t("Contact", "సంప్రదించండి")}</Link><Link href="/account/orders">{t("Your orders", "మీ ఆర్డర్లు")}</Link></div><div><strong>{t("Store information", "స్టోర్ సమాచారం")}</strong><Link href="/policies/privacy">{t("Privacy", "గోప్యత")}</Link><Link href="/policies/shipping">{t("Shipping", "షిప్పింగ్")}</Link><Link href="/policies/returns">{t("Returns & refunds", "రిటర్న్స్ మరియు రీఫండ్స్")}</Link><Link href="/policies/terms">{t("Terms", "నిబంధనలు")}</Link></div></div><div className="page-width footer-bottom"><span>© {new Date().getFullYear()} Narayana Naturals</span><Link href="/admin">{mode === "firebase" ? t("Owner dashboard", "యజమాని డాష్‌బోర్డ్") : t("Owner preview", "యజమాని ప్రివ్యూ")}<ArrowRight size={14} /></Link></div></footer>;
}

export function PageHeading({ title, description }: { title: string; description?: string }) {
  return <div className="page-heading"><h1>{title}</h1>{description && <p>{description}</p>}</div>;
}

export function EmptyState({ title, description, action = "Shop oil", href = "/shop" }: { title: string; description: string; action?: string; href?: string }) {
  return <div className="empty-state"><ShoppingBag size={38} strokeWidth={1.4} /><h2>{title}</h2><p>{description}</p><Link href={href} className="button primary">{action}<ArrowRight size={18} /></Link></div>;
}

export function Storefront() {
  const path = usePathname();
  const { t } = usePreview();
  if (path.startsWith("/admin")) return <AdminPage />;
  let content;
  if (path === "/") content = <HomePage />;
  else if (path === "/shop") content = <ShopPage />;
  else if (path === "/oil/groundnut") content = <ProductPage />;
  else if (path === "/cart") content = <CartPage />;
  else if (path === "/checkout") content = <CheckoutPage />;
  else if (path === "/sign-in") content = <SignInPage />;
  else if (path === "/account") content = <AccountPage />;
  else if (path === "/account/addresses") content = <AddressesPage />;
  else if (path === "/account/orders") content = <OrdersPage />;
  else if (path.startsWith("/account/orders/") || path.startsWith("/order-result/")) content = <OrderDetailPage id={path.split("/").at(-1)!} result={path.startsWith("/order-result/")} />;
  else content = <InfoPage path={path} />;
  return <><a className="skip-link" href="#main-content">{t("Skip to content", "ప్రధాన విషయానికి వెళ్లండి")}</a><Header /><ConnectionBanner /><GuideTip /><main id="main-content">{content}</main><Footer /></>;
}
