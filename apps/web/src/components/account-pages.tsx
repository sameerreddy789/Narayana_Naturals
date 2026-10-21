"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ClipboardList, Eye, EyeOff, HelpCircle, LogOut, MapPin, Package, RotateCcw, UserRound } from "lucide-react";
import { money, type Address, type DemoOrder } from "@/lib/demo";
import { privateDraft } from "@/lib/firebase";
import { usePreview } from "./preview-provider";
import { EmptyState, PageHeading } from "./storefront";
import { AddressFields } from "./shopping-pages";
import { DataStatus } from "./data-status";

export function SignInPage() {
  const { mode, ready, offline, connectionError, t, login, resetPassword, explainError, retryConnection } = usePreview();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [reset, setReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  function finish() {
    const destination = new URLSearchParams(window.location.search).get("returnTo");
    const valid = destination && (["/checkout", "/account", "/account/orders", "/account/addresses"].includes(destination) || /^\/admin(?:\/(?:orders|catalogue|inventory))?$/.test(destination));
    router.push(valid ? destination : "/account");
  }
  function changeForm(create: boolean) {
    setCreateAccount(create); setReset(false); setError(""); setNotice("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
    if (!validEmail) { setError(t("Enter a valid email address.", "సరైన ఇమెయిల్ చిరునామా నమోదు చేయండి.")); return; }
    if (!reset && (!password || (createAccount && (name.trim().length < 2 || password.length < 8)))) {
      setError(t("Enter your details. New accounts need a password with at least eight characters.", "మీ వివరాలు నమోదు చేయండి. కొత్త ఖాతాకు కనీసం ఎనిమిది అక్షరాల పాస్‌వర్డ్ అవసరం.")); return;
    }
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (reset) {
        await resetPassword(email);
        setNotice(mode === "emulator"
          ? t("This preview does not send email. The reset link is available in the local test session.", "ఈ ప్రివ్యూ ఇమెయిల్ పంపదు. రీసెట్ లింక్ స్థానిక పరీక్ష సెషన్‌లో అందుబాటులో ఉంది.")
          : t("If this email has an account, you’ll receive a password reset link.", "ఈ ఇమెయిల్‌కు ఖాతా ఉంటే, పాస్‌వర్డ్ రీసెట్ లింక్ వస్తుంది."));
      } else {
        await login({ email, password, name, createAccount });
        finish();
      }
    } catch (reason) { setError(explainError(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <section className="page-width auth-page"><div className="auth-intro">
    <h1>{t("A familiar place for your everyday oil.", "మీ రోజువారీ నూనె కోసం ఒక పరిచయమైన చోటు.")}</h1>
    <p>{privateDraft ? t("Use one account on the website and app. Your cart and saved address stay in sync. Demo receipts stay on the browser or phone where you confirm them.", "వెబ్‌సైట్ మరియు యాప్‌లో ఒకే ఖాతా వాడండి. మీ కార్ట్ మరియు సేవ్ చేసిన చిరునామా రెండింటిలో కనిపిస్తాయి. డెమో రసీదులు మీరు ధృవీకరించిన బ్రౌజర్ లేదా ఫోన్‌లోనే ఉంటాయి.") : t("Use one account on the website and app. Your packs, delivery address, and orders stay together.", "వెబ్‌సైట్ మరియు యాప్‌లో ఒకే ఖాతా వాడండి. మీ ప్యాక్‌లు, డెలివరీ చిరునామా మరియు ఆర్డర్లు కలిసి ఉంటాయి.")}</p>
    <div className="auth-points"><span><Package size={20} />{privateDraft ? t("Your shared shopping cart", "రెండింటిలో కనిపించే మీ కార్ట్") : t("Your packs and order history", "మీ ప్యాక్‌లు మరియు ఆర్డర్ చరిత్ర")}</span><span><MapPin size={20} />{t("A saved delivery address", "సేవ్ చేసిన డెలివరీ చిరునామా")}</span><span><HelpCircle size={20} />{t("A short guide on your first visit", "మీ మొదటి సందర్శనకు ఒక చిన్న గైడ్")}</span></div>
  </div><form className="auth-form" onSubmit={event => void submit(event)} aria-busy={busy}>
    <UserRound size={29} strokeWidth={1.5} />
    <h2>{reset ? t("Reset your password", "మీ పాస్‌వర్డ్ రీసెట్ చేయండి") : createAccount ? t("Create your account", "మీ ఖాతా సృష్టించండి") : t("Welcome back", "మళ్లీ స్వాగతం")}</h2>
    <p>{reset ? t("Enter your account email to request a reset link.", "రీసెట్ లింక్ కోసం మీ ఖాతా ఇమెయిల్ నమోదు చేయండి.") : t("Sign in with your email and password. We’ll ask for a delivery mobile number at checkout.", "మీ ఇమెయిల్ మరియు పాస్‌వర్డ్‌తో సైన్ ఇన్ చేయండి. చెక్అవుట్‌లో డెలివరీ మొబైల్ నంబర్ అడుగుతాము.")}</p>
    {!reset && <div className="auth-tabs" role="group" aria-label={t("Account options", "ఖాతా ఎంపికలు")}>
      <button type="button" disabled={busy} aria-pressed={!createAccount} onClick={() => changeForm(false)}>{t("Sign in", "సైన్ ఇన్")}</button>
      <button type="button" disabled={busy} aria-pressed={createAccount} onClick={() => changeForm(true)}>{t("Create account", "ఖాతా సృష్టించండి")}</button>
    </div>}
    {createAccount && !reset && <label>{t("Your name", "మీ పేరు")}<input required minLength={2} maxLength={100} disabled={busy} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder={t("Enter your name", "మీ పేరు నమోదు చేయండి")} /></label>}
    <label>{t("Email address", "ఇమెయిల్ చిరునామా")}<input required disabled={busy} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
    {!reset && <label>{t("Password", "పాస్‌వర్డ్")}<div className="password-field">
      <input required disabled={busy} type={showPassword ? "text" : "password"} autoComplete={createAccount ? "new-password" : "current-password"} minLength={createAccount ? 8 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} aria-describedby={createAccount ? "password-help" : undefined} />
      <button type="button" disabled={busy} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? t("Hide password", "పాస్‌వర్డ్ దాచండి") : t("Show password", "పాస్‌వర్డ్ చూపండి")}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
    </div>{createAccount && <small id="password-help">{t("Use at least eight characters.", "కనీసం ఎనిమిది అక్షరాలు వాడండి.")}</small>}</label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {connectionError && <DataStatus error={connectionError} onRetry={retryConnection} />}
    <button type="submit" className="primary-button full-button" disabled={busy || !ready || offline}>{busy ? t("Please wait…", "దయచేసి వేచి ఉండండి…") : reset ? t("Send reset link", "రీసెట్ లింక్ పంపండి") : createAccount ? t("Create account", "ఖాతా సృష్టించండి") : t("Sign in", "సైన్ ఇన్")}<ArrowRight size={18} /></button>
    {reset ? <button type="button" disabled={busy} className="text-button" onClick={() => { setReset(false); setError(""); setNotice(""); }}>{t("Back to sign in", "సైన్ ఇన్‌కు తిరిగి")}</button>
      : mode !== "demo" && <button type="button" disabled={busy} className="text-button" onClick={() => { setReset(true); setError(""); setNotice(""); }}>{t("Forgot password?", "పాస్‌వర్డ్ మర్చిపోయారా?")}</button>}
    <p className="small-note">{t("By continuing, you agree to our", "కొనసాగించడం ద్వారా మీరు మా")} <Link href="/policies/terms">{t("terms", "నిబంధనలకు")}</Link> {t("and", "మరియు")} <Link href="/policies/privacy">{t("privacy policy", "గోప్యతా విధానానికి")}</Link>.</p>
  </form></section>;
}

export function AccountPage() {
  const { state, mode, ready, accountReady, accountError, t, logout, replayGuide, toggleLanguage, guideBusy, explainError } = usePreview();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  if (!ready || (state.user && !accountReady)) return <section className="page-width standard-page"><DataStatus error={accountError} loading={t("Loading your account…", "మీ ఖాతా లోడ్ అవుతోంది…")} />{ready && state.user && accountError && <button className="button secondary" disabled={busy} onClick={() => void leave()}>{t("Sign out", "సైన్ అవుట్")}<LogOut size={18} /></button>}{error && <p className="error-text" role="alert">{error}</p>}</section>;
  if (!state.user) return <section className="page-width standard-page"><EmptyState title={t("Your account, your orders", "మీ ఖాతా, మీ ఆర్డర్లు")} description={t("Sign in with your email to find your saved address and orders.", "సేవ్ చేసిన చిరునామా మరియు ఆర్డర్ల కోసం మీ ఇమెయిల్‌తో సైన్ ఇన్ చేయండి.")} action={t("Sign in", "సైన్ ఇన్")} href="/sign-in" /></section>;
  async function leave() {
    setBusy(true); setError("");
    try { await logout(); router.push("/"); }
    catch (reason) { setError(explainError(reason)); setBusy(false); }
  }
  return <section className="page-width standard-page account-page"><PageHeading title={t("Hello", "హలో") + ", " + state.user.name} description={t("Your everyday essentials, all in one place.", "మీ అవసరాలు అన్నీ ఒకే చోట.")} />
    {accountError && <DataStatus error={accountError} />}
    <div className="account-layout"><div className="account-menu"><Link href="/account/orders"><ClipboardList size={23} /><span><strong>{t("Your orders", "మీ ఆర్డర్లు")}</strong><small>{t("View, follow or order again", "చూడండి, ట్రాక్ చేయండి లేదా మళ్లీ ఆర్డర్ చేయండి")}</small></span><ArrowRight size={18} /></Link>
      <Link href="/account/addresses"><MapPin size={23} /><span><strong>{t("Delivery address", "డెలివరీ చిరునామా")}</strong><small>{t("Ready for your next checkout", "తదుపరి చెక్అవుట్ కోసం")}</small></span><ArrowRight size={18} /></Link>
      <button onClick={() => void toggleLanguage()}><span className="language-icon" aria-hidden="true">అ</span><span><strong>{t("Language", "భాష")}</strong><small>{state.language === "en" ? "English → తెలుగు" : "తెలుగు → English"}</small></span><ArrowRight size={18} /></button>
      <button disabled={guideBusy} onClick={() => void replayGuide()}><HelpCircle size={23} /><span><strong>{guideBusy ? t("Saving guide…", "గైడ్ సేవ్ అవుతోంది…") : t("Replay guide", "గైడ్ మళ్లీ చూడండి")}</strong><small>{t("A quick introduction to each page", "ప్రతి పేజీకి చిన్న పరిచయం")}</small></span><RotateCcw size={18} /></button>
      {state.user.admin && mode !== "demo" && <Link href="/admin"><Package size={23} /><span><strong>{t("Owner dashboard", "యజమాని డాష్‌బోర్డ్")}</strong><small>{t("Manage catalogue and orders", "కేటలాగ్ మరియు ఆర్డర్లు నిర్వహించండి")}</small></span><ArrowRight size={18} /></Link>}
      <button disabled={busy} onClick={() => void leave()}><LogOut size={23} /><span><strong>{busy ? t("Signing out…", "సైన్ అవుట్ అవుతోంది…") : t("Sign out", "సైన్ అవుట్")}</strong><small>{t("Leave this account on this device", "ఈ పరికరంలో ఈ ఖాతా నుంచి బయటకు వెళ్లండి")}</small></span><ArrowRight size={18} /></button>
      {error && <p className="error-text" role="alert">{error}</p>}
    </div><aside className="account-profile"><UserRound size={28} strokeWidth={1.4} /><h2>{state.user.name}</h2><p className="account-email">{state.user.email || (state.user.phone ? "+91 " + state.user.phone : "")}</p><span className="status-badge">{t("Email account", "ఇమెయిల్ ఖాతా")}</span>
      <p className="small-note">{t("Your cart, address and guide progress are saved to your account. Sign in with the same email address on another device.", "మీ కార్ట్, చిరునామా మరియు గైడ్ ఖాతాలో సేవ్ అవుతాయి. మరో పరికరంలో అదే ఇమెయిల్ చిరునామాతో సైన్ ఇన్ చేయండి.")}</p>
    </aside></div>
  </section>;
}

export function AddressesPage() {
  const { state, mode, ready, accountReady, accountError, t, saveAddress, explainError, offline } = usePreview();
  const [address, setAddress] = useState<Address>({ name: "", phone: "", street: "", city: "", pin: "" });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formUid = useRef<string | null>(null);
  const busyRef = useRef(false);
  const uid = state.user?.uid;
  useEffect(() => {
    if (!ready || !accountReady || !uid) return;
    if (formUid.current !== uid || (!dirty && !busy)) {
      setAddress(state.addresses[uid] ?? { name: state.user!.name, phone: state.user!.phone, street: "", city: "", pin: "" });
      if (formUid.current !== uid) { setSaved(false); setDirty(false); setError(""); }
      formUid.current = uid;
    }
  }, [ready, accountReady, uid, state.addresses, state.user, dirty, busy]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setSaved(false); setError("");
    try { await saveAddress(address); setSaved(true); setDirty(false); }
    catch (reason) { setError(explainError(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <section className="page-width standard-page narrow-page"><PageHeading title={t("Your delivery address", "మీ డెలివరీ చిరునామా")} description={t("Save your default delivery address to your account.", "మీ సాధారణ డెలివరీ చిరునామాను ఖాతాలో సేవ్ చేయండి.")} />
    {!ready || (state.user && !accountReady) ? <DataStatus error={accountError} loading={t("Loading your address…", "మీ చిరునామా లోడ్ అవుతోంది…")} /> : !state.user ? <Link href="/sign-in?returnTo=/account/addresses" className="button primary">{t("Sign in", "సైన్ ఇన్")}</Link> : <form className="address-form" onSubmit={event => void save(event)} aria-busy={busy}>
      {accountError && <DataStatus error={accountError} />}
      <fieldset disabled={busy}><AddressFields address={address} onChange={next => { setAddress(next); setSaved(false); setDirty(true); setError(""); }} /></fieldset>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="form-footer"><button className="button primary" disabled={busy || (mode !== "demo" && offline)} type="submit">{busy ? t("Saving address…", "చిరునామా సేవ్ అవుతోంది…") : t("Save address", "చిరునామా సేవ్ చేయండి")}<Check size={18} /></button>
        {saved && <span className="success-text" role="status">{t("Address saved", "చిరునామా సేవ్ చేయబడింది")}</span>}
      </div>
    </form>}
  </section>;
}

export function OrdersPage() {
  return privateDraft ? <DemoReceiptsPage /> : <StandardOrdersPage />;
}

function DemoReceiptsPage() {
  const { state, demoReceipts, ready, accountReady, accountError, t } = usePreview();
  return <section className="page-width standard-page">
    <PageHeading title={t('Your demo receipts', 'మీ డెమో రసీదులు')}
      description={t('Saved in this browser for your account. No money is collected and no delivery is booked.', 'మీ ఖాతా కోసం ఈ బ్రౌజర్‌లో సేవ్ అవుతాయి. డబ్బు తీసుకోబడదు, డెలివరీ బుక్ చేయబడదు.')} />
    {!ready || (state.user && !accountReady) ? <DataStatus error={accountError} loading={t('Loading your receipts…', 'మీ రసీదులు లోడ్ అవుతున్నాయి…')} />
      : !state.user ? <EmptyState title={t('Sign in to view receipts', 'రసీదుల కోసం సైన్ ఇన్ చేయండి')} description={t('Use the account that completed the demo in this browser.', 'ఈ బ్రౌజర్‌లో డెమో పూర్తి చేసిన ఖాతా ఉపయోగించండి.')} action={t('Sign in', 'సైన్ ఇన్')} href="/sign-in?returnTo=/account/orders" />
      : !demoReceipts.length ? <EmptyState title={t('Try your first demo checkout', 'మీ మొదటి డెమో చెక్అవుట్ ప్రయత్నించండి')} description={t('Add a pack, enter your address and confirm the demo payment. Your receipt will appear here.', 'ప్యాక్ జోడించి, చిరునామా నమోదు చేసి డెమో చెల్లింపు ధృవీకరించండి. రసీదు ఇక్కడ కనిపిస్తుంది.')} action={t('View oil packs', 'నూనె ప్యాక్‌లు చూడండి')} />
      : <div className="order-list">{demoReceipts.map(receipt => <Link href={'/account/orders/' + receipt.id} key={receipt.id} className="order-list-item">
          <div className="order-list-symbol"><ClipboardList size={25} strokeWidth={1.5} /></div>
          <div><h2>{receipt.lines.map(line => `${line.litres} L × ${line.quantity}`).join(' · ')}</h2>
            <p>{new Intl.DateTimeFormat(state.language === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(receipt.createdAt))} · {t('Payment simulated', 'చెల్లింపు అనుకరణ')}</p></div>
          <div className="order-list-end"><strong>{money(receipt.totalPaise)}</strong><span className="status-badge">{t('Demo completed', 'డెమో పూర్తయింది')}</span></div><ArrowRight size={20} />
        </Link>)}</div>}
  </section>;
}

function StandardOrdersPage() {
  const { state, mode, ready, accountReady, ordersReady, accountError, ordersError, t } = usePreview();
  const orders = state.orders.filter(order => order.uid === state.user?.uid);
  return <section className="page-width standard-page"><PageHeading title={t("Your orders", "మీ ఆర్డర్లు")} description={t("See what is on its way, or choose a familiar pack again.", "మీ ఆర్డర్ స్థితి చూడండి లేదా మళ్లీ ప్యాక్ ఎంచుకోండి.")} />
    {!ready || (state.user && (!accountReady || !ordersReady)) ? <DataStatus error={accountError || ordersError} loading={t("Loading your orders…", "మీ ఆర్డర్లు లోడ్ అవుతున్నాయి…")} /> : !state.user ? <EmptyState title={t("Find your orders", "మీ ఆర్డర్లు చూడండి")} description={t("Sign in with the email address used to place your order.", "ఆర్డర్ చేసిన ఇమెయిల్ చిరునామాతో సైన్ ఇన్ చేయండి.")} action={t("Sign in", "సైన్ ఇన్")} href="/sign-in?returnTo=/account/orders" />
      : ordersError ? <DataStatus error={ordersError} /> : !orders.length ? <EmptyState title={privateDraft ? t("No test orders", "పరీక్ష ఆర్డర్లు లేవు") : t("Your first order starts here", "మీ మొదటి ఆర్డర్ ఇక్కడ మొదలవుతుంది")} description={privateDraft ? t("This private demonstration does not accept orders. You can view the example packs and manage your account.", "ఈ ప్రైవేట్ ప్రదర్శనలో ఆర్డర్లు తీసుకోబడవు. నమూనా ప్యాక్‌లు చూడవచ్చు, మీ ఖాతాను నిర్వహించవచ్చు.") : t("Choose an oil pack and review checkout. Your confirmed order will appear here.", "నూనె ప్యాక్ ఎంచుకుని చెక్అవుట్ చూడండి. నిర్ధారించిన ఆర్డర్ ఇక్కడ కనిపిస్తుంది.")} action={t("View oil packs", "నూనె ప్యాక్‌లు చూడండి")} />
        : <><div className="order-list">{orders.map(order => <Link href={"/account/orders/" + order.id} key={order.id} className="order-list-item"><div className="order-list-symbol"><Package size={25} strokeWidth={1.5} /></div>
          <div><h2>{order.lines.map(line => line.litres + " L × " + line.quantity).join(" · ")}</h2><p>{new Intl.DateTimeFormat(state.language === "te" ? "te-IN" : "en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(order.createdAt))} · {order.preview ? mode === "demo" ? t("Demo order", "డెమో ఆర్డర్") : t("Preview order", "ప్రివ్యూ ఆర్డర్") : t("Cash on delivery", "డెలివరీ సమయంలో నగదు")}</p></div>
          <div className="order-list-end"><strong>{money(order.totalPaise)}</strong><span className="status-badge">{statusLabel(order.status, t)}</span></div><ArrowRight size={20} />
        </Link>)}</div>{orders.length === 50 && <p className="small-note">{t("Showing your 50 most recent orders.", "మీ ఇటీవలి 50 ఆర్డర్లు కనిపిస్తున్నాయి.")}</p>}</>}
  </section>;
}

export function statusLabel(status: DemoOrder["status"], t: (en: string, te: string) => string) {
  return { received: t("Received", "స్వీకరించబడింది"), packed: t("Packed", "ప్యాక్ చేయబడింది"), shipped: t("Shipped", "పంపబడింది"), delivered: t("Delivered", "డెలివరీ అయింది"), cancelled: t("Cancelled", "రద్దయింది") }[status];
}

export function useOrderRecord(id: string | undefined, owner = false) {
  const { state, mode, ready, accountReady, ownerOrders, watchOrder, explainError } = usePreview();
  const [remote, setRemote] = useState<DemoOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const uid = state.user?.uid;
  const admin = state.user?.admin;
  useEffect(() => {
    setRemote(null); setError("");
    if (!id || !ready || !accountReady || !uid || (owner && !admin) || mode === "demo") { setLoading(false); return; }
    setLoading(true);
    try {
      return watchOrder(id, order => { setRemote(order); setLoading(false); }, reason => { setError(explainError(reason)); setLoading(false); }, owner);
    } catch (reason) { setError(explainError(reason)); setLoading(false); }
  }, [id, uid, admin, owner, ready, accountReady, mode, watchOrder, explainError]);
  const order = (owner ? ownerOrders : state.orders).find(order => order.id === id && (owner || order.uid === uid)) ?? (remote && (owner || remote.uid === uid) ? remote : null);
  return { order, loading, error };
}

export function OrderDetailPage({ id, result = false }: { id: string; result?: boolean }) {
  return privateDraft ? <DemoReceiptPage id={id} result={result} /> : <StandardOrderDetailPage id={id} result={result} />;
}

function DemoReceiptPage({ id, result }: { id: string; result: boolean }) {
  const { state, demoReceipts, ready, accountReady, accountError, cartBusy, addPack, t } = usePreview();
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const receipt = demoReceipts.find(receipt => receipt.id === id && receipt.uid === state.user?.uid);
  if (!ready || (state.user && !accountReady)) return <section className="page-width standard-page"><DataStatus error={accountError} loading={t('Loading your demo receipt…', 'మీ డెమో రసీదు లోడ్ అవుతోంది…')} /></section>;
  if (!receipt) return <section className="page-width standard-page"><EmptyState title={t('Demo receipt unavailable', 'డెమో రసీదు అందుబాటులో లేదు')}
    description={t('Sign in to the same account in the browser where you confirmed this demo. Receipts are stored locally.', 'ఈ డెమో ధృవీకరించిన బ్రౌజర్‌లో అదే ఖాతాతో సైన్ ఇన్ చేయండి. రసీదులు స్థానికంగా సేవ్ అవుతాయి.')} action={t('Your receipts', 'మీ రసీదులు')} href="/account/orders" /></section>;
  async function again() {
    if (adding || !receipt) return;
    setAdding(true);
    try {
      let added = false;
      for (const line of receipt.lines) if (await addPack(line.id, line.quantity)) added = true;
      if (added) router.push('/cart');
    } finally { setAdding(false); }
  }
  return <section className="page-width standard-page">
    <div className="order-confirmation-heading">{result && <CheckCircle2 size={45} strokeWidth={1.3} />}
      <PageHeading title={result ? t('Demo payment confirmed', 'డెమో చెల్లింపు ధృవీకరించబడింది') : t('Your demo receipt', 'మీ డెమో రసీదు')}
        description={t('No money was collected and no delivery was booked. This receipt is saved in this browser for your account.', 'డబ్బు తీసుకోబడలేదు, డెలివరీ బుక్ కాలేదు. మీ ఖాతా కోసం ఈ బ్రౌజర్‌లో రసీదు సేవ్ అయింది.')} />
    </div><p className="small-note order-reference">{receipt.id}</p>
    <div className="order-detail-layout"><div>
      <div className="detail-block"><h2>{t('Your oil packs', 'మీ నూనె ప్యాక్‌లు')}</h2>
        {receipt.lines.map(line => <div className="summary-row" key={line.id}><span>{line.litres} L × {line.quantity}<br /><small>{money(line.unitPricePaise)} {t('per pack', 'ఒక ప్యాక్‌కు')}</small></span><strong>{money(line.unitPricePaise * line.quantity)}</strong></div>)}
        <p className="small-note">{t('Example prices · Stock unconfirmed', 'నమూనా ధరలు · స్టాక్ నిర్ధారించాలి')}</p>
        <button className="button secondary" disabled={adding || cartBusy} onClick={() => void again()}>{adding ? t('Adding packs…', 'ప్యాక్‌లు చేరుతున్నాయి…') : t('Add these packs again', 'ఈ ప్యాక్‌లు మళ్లీ జోడించండి')}<RotateCcw size={17} /></button>
      </div>
      <div className="detail-block"><h2><MapPin size={20} />{t('Delivery details', 'డెలివరీ వివరాలు')}</h2><p>{receipt.address.name}<br />{receipt.address.street}<br />{receipt.address.city} — {receipt.address.pin}<br />+91 {receipt.address.phone}</p></div>
      <div className="detail-block"><h2>{t('Demonstration complete', 'ప్రదర్శన పూర్తయింది')}</h2><p>{t('Your address and billing flow are complete. No payment transaction or shipment has been created.', 'చిరునామా, బిల్లింగ్ ప్రదర్శన పూర్తయింది. చెల్లింపు లావాదేవీ లేదా రవాణా సృష్టించబడలేదు.')}</p></div>
    </div><aside className="order-summary"><h2>{t('Demo bill summary', 'డెమో బిల్లు సారాంశం')}</h2>
      <div className="summary-row"><span>{t('Products', 'ఉత్పత్తులు')}</span><strong>{money(receipt.subtotalPaise)}</strong></div>
      <div className="summary-row"><span>{t('Demo delivery', 'డెమో డెలివరీ')}</span><span>₹0</span></div><hr />
      <div className="summary-row total"><span>{t('Demo total', 'డెమో మొత్తం')}</span><strong>{money(receipt.totalPaise)}</strong></div>
      <div className="payment-summary"><strong>{t('Payment simulated', 'చెల్లింపు అనుకరణ')}</strong><p>{t('Amount collected: ₹0', 'తీసుకోబడిన మొత్తం: ₹0')}</p></div>
      <Link href="/account/orders" className="button secondary full-width">{t('View all demo receipts', 'అన్ని డెమో రసీదులు చూడండి')}<ArrowRight size={17} /></Link>
    </aside></div>
  </section>;
}

function StandardOrderDetailPage({ id, result = false }: { id: string; result?: boolean }) {
  const { state, mode, ready, accountReady, accountError, t, addPack } = usePreview();
  const { order, loading, error } = useOrderRecord(id);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  if (!ready || (state.user && !accountReady) || (loading && !order)) return <section className="page-width standard-page"><DataStatus error={accountError} loading={t("Loading your order…", "మీ ఆర్డర్ లోడ్ అవుతోంది…")} /></section>;
  if (error) return <section className="page-width standard-page"><DataStatus error={error} /></section>;
  if (!order) return <section className="page-width standard-page"><EmptyState title={t("This order is not available", "ఈ ఆర్డర్ అందుబాటులో లేదు")} description={t("Sign in with the email address that placed it, or return to your orders.", "ఈ ఆర్డర్ చేసిన ఇమెయిల్ చిరునామాతో సైన్ ఇన్ చేయండి లేదా మీ ఆర్డర్లకు తిరిగి వెళ్లండి.")} action={t("Your orders", "మీ ఆర్డర్లు")} href="/account/orders" /></section>;
  const statuses: DemoOrder["status"][] = ["received", "packed", "shipped", "delivered"];
  const index = statuses.indexOf(order.status);
  async function orderAgain() {
    if (adding || !order) return;
    setAdding(true);
    let added = false;
    for (const line of order.lines) if (await addPack(line.id, line.quantity)) added = true;
    setAdding(false);
    if (added) router.push("/cart");
  }
  return <section className="page-width standard-page"><div className="order-confirmation-heading">{result && <CheckCircle2 size={45} strokeWidth={1.3} />}
    <PageHeading title={result ? order.preview ? mode === "demo" ? t("Your demo order is in!", "మీ డెమో ఆర్డర్ అయింది!") : t("Your preview order is saved", "మీ ప్రివ్యూ ఆర్డర్ సేవ్ అయింది") : t("Your order is in!", "మీ ఆర్డర్ అయింది!") : t("Your order", "మీ ఆర్డర్")}
      description={result ? order.preview ? t("Preview order only. No money was collected and no delivery was booked.", "ప్రివ్యూ ఆర్డర్ మాత్రమే. డబ్బు తీసుకోబడలేదు, డెలివరీ బుక్ చేయబడలేదు.") : t("Your cash-on-delivery order has been received. Follow its progress here.", "మీ నగదు చెల్లింపు ఆర్డర్ స్వీకరించబడింది. స్థితి ఇక్కడ చూడండి.") : order.id} />
  </div>{result && <p className="small-note order-reference">{order.id}</p>}
    <div className="order-detail-layout"><div>{order.status === "cancelled" ? <div className="detail-block"><h2>{t("Order cancelled", "ఆర్డర్ రద్దయింది")}</h2><p>{t("This order has been cancelled and no COD payment is due.", "ఈ ఆర్డర్ రద్దయింది. నగదు చెల్లింపు అవసరం లేదు.")}</p></div> : <div className="order-timeline">{statuses.map((status, i) => <div key={status} className={i <= index ? "complete" : ""}><span>{i <= index ? <Check size={17} /> : <span className="timeline-dot" />}</span><strong>{statusLabel(status, t)}</strong></div>)}</div>}
      <p className="small-note">{order.preview ? t("This is a sample order for preview testing.", "ఇది ప్రివ్యూ పరీక్ష కోసం నమూనా ఆర్డర్.") : t("The store updates your order as it is packed, shipped and delivered.", "ప్యాక్, షిప్పింగ్ మరియు డెలివరీ సమయంలో స్టోర్ ఆర్డర్ స్థితిని మారుస్తుంది.")}</p>
      <div className="detail-block"><h2>{t("Your oil packs", "మీ నూనె ప్యాక్‌లు")}</h2>{order.lines.map(line => <div className="summary-row" key={line.id}><span>{t("Ghani groundnut oil", "ఘానీ వేరుశెనగ నూనె")} · {line.litres} L × {line.quantity}</span><strong>{money(line.unitPricePaise * line.quantity)}</strong></div>)}
        <button className="button secondary" disabled={adding} onClick={() => void orderAgain()}>{adding ? t("Adding packs…", "ప్యాక్‌లు చేరుతున్నాయి…") : t("Order again", "మళ్లీ ఆర్డర్ చేయండి")}<RotateCcw size={17} /></button>
      </div><div className="detail-block"><h2><MapPin size={20} />{t("Delivery address", "డెలివరీ చిరునామా")}</h2><p>{order.address.name}<br />{order.address.street}<br />{order.address.city} — {order.address.pin}<br />+91 {order.address.phone}</p></div>
    </div><aside className="order-summary"><h2>{t("Order summary", "ఆర్డర్ సారాంశం")}</h2><div className="summary-row"><span>{t("Subtotal", "ఉప మొత్తం")}</span><strong>{money(order.subtotalPaise)}</strong></div><div className="summary-row"><span>{t("Delivery", "డెలివరీ")}</span><strong>{money(order.shippingPaise)}</strong></div><hr /><div className="summary-row total"><span>{t("Total", "మొత్తం")}</span><strong>{money(order.totalPaise)}</strong></div>
      <div className="payment-summary"><strong>{order.preview ? t("Cash on delivery — preview", "డెలివరీ సమయంలో నగదు — ప్రివ్యూ") : t("Cash on delivery", "డెలివరీ సమయంలో నగదు")}</strong><p>{order.preview ? t("No real money has been collected.", "అసలు డబ్బు తీసుకోబడలేదు.") : order.paymentStatus === "collected" ? t("Payment collected on delivery.", "డెలివరీ సమయంలో చెల్లింపు తీసుకోబడింది.") : order.paymentStatus === "cancelled" ? t("Cancelled — no payment due.", "రద్దయింది — చెల్లింపు అవసరం లేదు.") : t("Payment is due on delivery.", "డెలివరీ సమయంలో చెల్లించండి.")}</p></div>
      <Link href="/account/orders" className="button secondary full-width">{t("View all orders", "అన్ని ఆర్డర్లు చూడండి")}<ArrowRight size={17} /></Link><Link href="/contact" className="small-link">{t("Need help?", "సహాయం కావాలా?")}</Link>
    </aside></div>
  </section>;
}
