import { isIndianMobile, type Address, type CartLine, type DemoOrder, type Language, type PackId, type Variant } from "./demo";

export const PACK_IDS: PackId[] = ["1l", "2l", "5l"];
export const PACK_LITRES: Record<PackId, number> = { "1l": 1, "2l": 2, "5l": 5 };
export type Bilingual = { en: string; te: string };
export type Product = { published: boolean; name: Bilingual; description: Bilingual; ingredients: Bilingual; extraction: Bilingual; storage: Bilingual; preview?: boolean };
export type StorefrontSettings = { orderingEnabled: boolean; onlinePaymentsEnabled: false; preview: boolean; supportPhone?: string; notice?: Bilingual };
export type Onboarding = { welcomeSeen: boolean; skipped: boolean; dismissedPages: string[] };
export type DeliveryCheck = { local: boolean; feePaise: number; codAllowed: boolean; estimate: string; city?: string; preview: boolean };
export type CheckoutQuote = { quoteId: string; subtotalPaise: number; shippingPaise: number; totalPaise: number; codAllowed: boolean; estimate: string; expiresAt: string; preview: boolean; lines: DemoOrder["lines"] };
export const EMPTY_ONBOARDING: Onboarding = { welcomeSeen: false, skipped: false, dismissedPages: [] };

export class StoreError extends Error {
  constructor(public readonly code: string, message?: string) { super(message ?? code); this.name = "StoreError"; }
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function integer(value: unknown, min = 0, max = 100_000_000): value is number { return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max; }
function bilingual(value: unknown): value is Bilingual { return object(value) && typeof value.en === "string" && typeof value.te === "string"; }
export function isPackId(value: unknown): value is PackId { return PACK_IDS.includes(value as PackId); }

export function validateAddress(address: Address): Address {
  if (!object(address) || !(["name", "phone", "street", "city", "pin"] as (keyof Address)[]).every(key => typeof address[key] === "string")) throw new StoreError("INVALID_ADDRESS");
  const next: Address = { name: address.name.trim(), phone: address.phone.trim(), street: address.street.trim(), city: address.city.trim(), pin: address.pin.trim() };
  if (next.name.length < 2 || next.name.length > 100 || !isIndianMobile(next.phone) || next.street.length < 5 || next.street.length > 300 || next.city.length < 2 || next.city.length > 100 || !/^[1-9]\d{5}$/.test(next.pin)) throw new StoreError("INVALID_ADDRESS");
  return next;
}

export function parseCart(data: unknown): CartLine[] {
  if (data === undefined || data === null) return [];
  if (object(data) && (data.lines === undefined || data.lines === null)) return [];
  if (!object(data) || !Array.isArray(data.lines) || data.lines.length > 3) throw new StoreError("INVALID_DATA");
  const lines = data.lines.map(line => {
    if (!object(line) || !isPackId(line.id) || !integer(line.quantity, 1, 20)) throw new StoreError("INVALID_DATA");
    return { id: line.id, quantity: line.quantity };
  });
  if (new Set(lines.map(line => line.id)).size !== lines.length) throw new StoreError("INVALID_DATA");
  return lines.sort((a, b) => PACK_IDS.indexOf(a.id) - PACK_IDS.indexOf(b.id));
}

// Keeping the larger quantity makes a guest merge safe to retry after a reload.
export function mergeGuestCart(saved: CartLine[], guest: CartLine[]): CartLine[] {
  return PACK_IDS.flatMap(id => {
    const quantity = Math.max(saved.find(line => line.id === id)?.quantity ?? 0, guest.find(line => line.id === id)?.quantity ?? 0);
    return quantity ? [{ id, quantity: Math.min(quantity, 20) }] : [];
  });
}

// Apply the requested final quantity only while its original value still
// matches. A later edit on another client takes precedence over a retry.
export function mergeCartEdit(saved: CartLine[], before: CartLine[], intended: CartLine[]): CartLine[] {
  return PACK_IDS.flatMap(id => {
    const original = before.find(line => line.id === id)?.quantity ?? 0;
    const desired = intended.find(line => line.id === id)?.quantity ?? 0;
    const current = saved.find(line => line.id === id)?.quantity ?? 0;
    const quantity = original !== desired && (current === original || current === desired) ? desired : current;
    return quantity ? [{ id, quantity }] : [];
  });
}

export function removePurchasedLines(saved: CartLine[], purchased: CartLine[]): CartLine[] {
  return saved.filter(line => purchased.find(item => item.id === line.id)?.quantity !== line.quantity);
}

export function parseVariant(id: string, data: unknown): Variant {
  if (!object(data) || !isPackId(id) || data.id !== id || data.litres !== PACK_LITRES[id] || !integer(data.pricePaise, 100, 1_000_000) || !integer(data.stock, 0, 100_000_000) || typeof data.enabled !== "boolean") throw new StoreError("INVALID_DATA");
  if (data.stockConfirmed !== undefined && typeof data.stockConfirmed !== "boolean") throw new StoreError("INVALID_DATA");
  return { id, litres: PACK_LITRES[id], pricePaise: data.pricePaise, stock: data.stock, enabled: data.enabled, preview: data.preview === true, ...(typeof data.stockConfirmed === "boolean" ? { stockConfirmed: data.stockConfirmed } : {}) };
}
export function parseProduct(data: unknown): Product | null {
  if (data === undefined || data === null) return null;
  if (!object(data) || typeof data.published !== "boolean" || !bilingual(data.name) || !bilingual(data.description) || !bilingual(data.ingredients) || !bilingual(data.extraction) || !bilingual(data.storage)) throw new StoreError("INVALID_DATA");
  return { published: data.published, name: data.name, description: data.description, ingredients: data.ingredients, extraction: data.extraction, storage: data.storage, preview: data.preview === true };
}
export function parseSettings(data: unknown): StorefrontSettings | null {
  if (data === undefined || data === null) return null;
  if (!object(data) || typeof data.orderingEnabled !== "boolean" || data.onlinePaymentsEnabled !== false || typeof data.preview !== "boolean" || (data.notice !== undefined && !bilingual(data.notice))) throw new StoreError("INVALID_DATA");
  return { orderingEnabled: data.orderingEnabled, onlinePaymentsEnabled: false, preview: data.preview, ...(typeof data.supportPhone === "string" ? { supportPhone: data.supportPhone } : {}), ...(bilingual(data.notice) ? { notice: data.notice } : {}) };
}
export function parseOnboarding(data: unknown): Onboarding {
  if (data === undefined || data === null) return { ...EMPTY_ONBOARDING, dismissedPages: [] };
  if (object(data) && (data.dismissedPages === undefined || data.dismissedPages === null)) data = { ...data, dismissedPages: [] };
  if (!object(data) || typeof data.welcomeSeen !== "boolean" || typeof data.skipped !== "boolean" || !Array.isArray(data.dismissedPages) || !data.dismissedPages.every(page => typeof page === "string")) throw new StoreError("INVALID_DATA");
  return { welcomeSeen: data.welcomeSeen, skipped: data.skipped, dismissedPages: data.dismissedPages };
}
function parseOrderLines(value: unknown): DemoOrder["lines"] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new StoreError("INVALID_DATA");
  return value.map(line => {
    if (!object(line) || !isPackId(line.id) || line.litres !== PACK_LITRES[line.id] || !integer(line.quantity, 1, 20) || !integer(line.unitPricePaise, 100, 1_000_000)) throw new StoreError("INVALID_DATA");
    return { id: line.id, litres: PACK_LITRES[line.id], quantity: line.quantity, unitPricePaise: line.unitPricePaise };
  });
}
export function parseOrder(id: string, data: unknown): DemoOrder | null {
  if (data === undefined || data === null) return null;
  if (object(data) && typeof data.createdAt === "number") {
    if (!Number.isSafeInteger(data.createdAt) || data.createdAt < 0 || data.createdAt > 8_640_000_000_000_000) throw new StoreError("INVALID_DATA");
    data = { ...data, createdAt: new Date(data.createdAt).toISOString() };
  }
  if (!object(data) || data.id !== id || typeof data.uid !== "string" || typeof data.customerPhone !== "string" || !/^\+91[6-9]\d{9}$/.test(data.customerPhone) || typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)) || !object(data.address) || !integer(data.subtotalPaise) || !integer(data.shippingPaise) || !integer(data.totalPaise) || data.totalPaise !== data.subtotalPaise + data.shippingPaise || data.paymentMethod !== "cod" || !["pending_collection", "collected", "cancelled"].includes(data.paymentStatus as string) || !["received", "packed", "shipped", "delivered", "cancelled"].includes(data.status as string) || !["web", "android"].includes(data.channel as string) || typeof data.preview !== "boolean") throw new StoreError("INVALID_DATA");
  return { id, uid: data.uid, customerPhone: data.customerPhone, createdAt: data.createdAt, lines: parseOrderLines(data.lines), address: validateAddress(data.address as Address), subtotalPaise: data.subtotalPaise, shippingPaise: data.shippingPaise, totalPaise: data.totalPaise, paymentMethod: "cod", paymentStatus: data.paymentStatus as DemoOrder["paymentStatus"], status: data.status as DemoOrder["status"], channel: data.channel as DemoOrder["channel"], preview: data.preview };
}
export function parseQuote(data: unknown): CheckoutQuote {
  if (object(data) && typeof data.expiresAt === "number") {
    if (!Number.isSafeInteger(data.expiresAt) || data.expiresAt < 0 || data.expiresAt > 8_640_000_000_000_000) throw new StoreError("INVALID_DATA");
    data = { ...data, expiresAt: new Date(data.expiresAt).toISOString() };
  }
  if (!object(data) || typeof data.quoteId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(data.quoteId) || !integer(data.subtotalPaise) || !integer(data.shippingPaise) || !integer(data.totalPaise) || data.totalPaise !== data.subtotalPaise + data.shippingPaise || typeof data.codAllowed !== "boolean" || typeof data.estimate !== "string" || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt)) || typeof data.preview !== "boolean") throw new StoreError("INVALID_DATA");
  return { quoteId: data.quoteId, subtotalPaise: data.subtotalPaise, shippingPaise: data.shippingPaise, totalPaise: data.totalPaise, codAllowed: data.codAllowed, estimate: data.estimate, expiresAt: data.expiresAt, preview: data.preview, lines: parseOrderLines(data.lines) };
}
export function errorCode(error: unknown): string {
  if (error instanceof StoreError) return error.code;
  if (object(error)) {
    if (object(error.details) && typeof error.details.code === "string") return error.details.code;
    if (typeof error.code === "string") return error.code.startsWith("appCheck/") ? "APP_CHECK_REQUIRED" : error.code === "PERMISSION_DENIED" ? "permission-denied" : error.code.replace(/^(functions|auth|database)\//, "");
  }
  return "UNKNOWN";
}
export function errorMessage(error: unknown, t: (en: string, te: string) => string): string {
  const messages: Record<string, [string, string]> = {
    DEMO_PIN: ["Use PIN 517502 for this demonstration. No real delivery is booked.", "ఈ ప్రదర్శనకు పిన్ 517502 ఉపయోగించండి. నిజమైన డెలివరీ బుక్ చేయబడదు."],
    LOCAL_STORAGE: ["The demo receipt could not be saved in this browser. Enable browser storage or free some space, then retry.", "ఈ బ్రౌజర్‌లో డెమో రసీదు సేవ్ కాలేదు. బ్రౌజర్ నిల్వను అనుమతించండి లేదా స్థలం ఖాళీ చేసి మళ్లీ ప్రయత్నించండి."],
    AUTH_REQUIRED: ["Sign in before continuing.", "కొనసాగించే ముందు సైన్ ఇన్ చేయండి."],
    unauthenticated: ["This request could not be verified. Sign in again or contact the business.", "ఈ అభ్యర్థన ధృవీకరించబడలేదు. మళ్లీ సైన్ ఇన్ చేయండి లేదా వ్యాపారాన్ని సంప్రదించండి."],
    ADMIN_REQUIRED: ["This account does not have owner access.", "ఈ ఖాతాకు యజమాని అనుమతి లేదు."],
    TESTER_REQUIRED: ["This private draft is for invited testers. Ask the owner to enable access for your email account.", "ఈ ప్రైవేట్ డ్రాఫ్ట్ ఆహ్వానించిన పరీక్షకుల కోసం. మీ ఇమెయిల్ ఖాతాకు అనుమతి ఇవ్వమని యజమానిని అడగండి."],
    "permission-denied": ["This account cannot access these details. Check your sign-in or contact the business.", "ఈ ఖాతాకు ఈ వివరాల అనుమతి లేదు. సైన్ ఇన్ చూడండి లేదా వ్యాపారాన్ని సంప్రదించండి."],
    INVALID_INPUT: ["Check the fields and quantities, then try again.", "వివరాలు మరియు పరిమాణాలను సరిచూసి మళ్లీ ప్రయత్నించండి."],
    INVALID_ADDRESS: ["Enter a full name, valid mobile number, street address, city and six-digit PIN.", "పూర్తి పేరు, సరైన మొబైల్ నంబర్, వీధి చిరునామా, నగరం మరియు ఆరు అంకెల పిన్ నమోదు చేయండి."],
    STORE_NOT_READY: ["Ordering is currently unavailable. Please check back or contact the business.", "ప్రస్తుతం ఆర్డర్లు అందుబాటులో లేవు. తరువాత చూడండి లేదా వ్యాపారాన్ని సంప్రదించండి."],
    NOT_SERVICEABLE: ["Delivery is not available for this PIN. Check the PIN or use another delivery address.", "ఈ పిన్‌కు డెలివరీ లేదు. పిన్‌ను సరిచూడండి లేదా మరో చిరునామా వాడండి."],
    OUT_OF_STOCK: ["A selected pack is unavailable. Review the packs and quantities in your cart.", "ఎంచుకున్న ప్యాక్ అందుబాటులో లేదు. కార్ట్‌లో ప్యాక్‌లు మరియు పరిమాణాలను సరిచూడండి."],
    QUOTE_EXPIRED: ["This total has expired. Review a new total before ordering.", "ఈ మొత్తం గడువు ముగిసింది. ఆర్డర్ ముందు కొత్త మొత్తం చూడండి."],
    QUOTE_CHANGED: ["Prices or delivery terms changed. Review the new total before placing your order.", "ధరలు లేదా డెలివరీ వివరాలు మారాయి. ఆర్డర్ ముందు కొత్త మొత్తం చూడండి."],
    QUOTE_NOT_FOUND: ["This checkout review is no longer available. Review your total again.", "ఈ చెక్అవుట్ వివరాలు అందుబాటులో లేవు. మొత్తం మళ్లీ చూడండి."],
    QUOTE_OWNER_MISMATCH: ["This checkout belongs to another account. Review a new total using your account.", "ఈ చెక్అవుట్ మరో ఖాతాకు చెందినది. మీ ఖాతాతో కొత్త మొత్తం చూడండి."],
    COD_UNAVAILABLE: ["Cash on delivery is unavailable for this PIN. Online payment is not available yet.", "ఈ పిన్‌కు నగదు చెల్లింపు లేదు. ఆన్‌లైన్ చెల్లింపు ఇంకా అందుబాటులో లేదు."],
    IDEMPOTENCY_CONFLICT: ["This checkout retry is no longer valid. Review a new total.", "ఈ చెక్అవుట్ మళ్లీ ప్రయత్నించడం చెల్లదు. కొత్త మొత్తం చూడండి."],
    ORDER_NOT_FOUND: ["This order could not be found. Return to your order list.", "ఈ ఆర్డర్ కనిపించలేదు. మీ ఆర్డర్ల జాబితాకు వెళ్లండి."],
    INVALID_TRANSITION: ["That order stage is unavailable. Refresh the order and choose its next stage.", "ఆ ఆర్డర్ స్థితి అందుబాటులో లేదు. ఆర్డర్ మళ్లీ లోడ్ చేసి తదుపరి స్థితి ఎంచుకోండి."],
    RATE_LIMITED: ["Please wait a minute before trying checkout again.", "చెక్అవుట్ మళ్లీ ప్రయత్నించే ముందు ఒక నిమిషం వేచి ఉండండి."],
    "too-many-requests": ["Too many attempts. Wait a few minutes and try again.", "చాలా ప్రయత్నాలు అయ్యాయి. కొన్ని నిమిషాలు వేచి మళ్లీ ప్రయత్నించండి."],
    "invalid-email": ["Enter a valid email address.", "సరైన ఇమెయిల్ చిరునామా నమోదు చేయండి."],
    "invalid-credential": ["The email or password is incorrect. Check your details or reset your password.", "ఇమెయిల్ లేదా పాస్‌వర్డ్ తప్పు. వివరాలు సరిచూడండి లేదా పాస్‌వర్డ్ రీసెట్ చేయండి."],
    "wrong-password": ["The email or password is incorrect.", "ఇమెయిల్ లేదా పాస్‌వర్డ్ తప్పు."],
    "user-not-found": ["The email or password is incorrect.", "ఇమెయిల్ లేదా పాస్‌వర్డ్ తప్పు."],
    "email-already-in-use": ["This email already has an account. Sign in or reset your password.", "ఈ ఇమెయిల్‌కు ఇప్పటికే ఖాతా ఉంది. సైన్ ఇన్ చేయండి లేదా పాస్‌వర్డ్ రీసెట్ చేయండి."],
    "weak-password": ["Use a password with at least eight characters.", "కనీసం ఎనిమిది అక్షరాల పాస్‌వర్డ్ వాడండి."],
    "user-disabled": ["This account is unavailable. Please contact the business.", "ఈ ఖాతా అందుబాటులో లేదు. వ్యాపారాన్ని సంప్రదించండి."],
    "operation-not-allowed": ["Email sign-in has not been enabled yet. Please contact the business.", "ఇమెయిల్ సైన్ ఇన్ ఇంకా ప్రారంభించబడలేదు. వ్యాపారాన్ని సంప్రదించండి."],
    API_NOT_CONFIGURED: ["The order service is not connected yet. Please contact the business.", "ఆర్డర్ సేవ ఇంకా కనెక్ట్ కాలేదు. వ్యాపారాన్ని సంప్రదించండి."],
    APP_CHECK_REQUIRED: ["The security check could not complete. Try again or contact the business.", "భద్రతా తనిఖీ పూర్తి కాలేదు. మళ్లీ ప్రయత్నించండి లేదా వ్యాపారాన్ని సంప్రదించండి."],
    EMAIL_REQUIRED: ["Sign in using your email account before continuing.", "కొనసాగించే ముందు మీ ఇమెయిల్ ఖాతాతో సైన్ ఇన్ చేయండి."],
    STORE_CAPACITY: ["Ordering is temporarily paused. Your existing orders are saved. Please contact the business.", "ఆర్డర్లు తాత్కాలికంగా నిలిపివేయబడ్డాయి. మీ పాత ఆర్డర్లు భద్రంగా ఉన్నాయి. వ్యాపారాన్ని సంప్రదించండి."],
    UNAVAILABLE: ["The order service could not complete this request. Retry the same order to check its result.", "ఆర్డర్ సేవ ఈ అభ్యర్థన పూర్తి చేయలేకపోయింది. ఫలితం కోసం అదే ఆర్డర్‌ను మళ్లీ ప్రయత్నించండి."],
    "network-request-failed": ["The connection failed. Check your internet connection and try again.", "కనెక్షన్ విఫలమైంది. ఇంటర్నెట్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి."],
    unavailable: ["The store could not be reached. Check your connection and try again.", "స్టోర్‌కు కనెక్ట్ కాలేదు. కనెక్షన్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి."],
    "deadline-exceeded": ["The request took too long. Try again; an order retry keeps the same checkout reference.", "అభ్యర్థన ఎక్కువ సమయం తీసుకుంది. మళ్లీ ప్రయత్నించండి; ఆర్డర్‌కు అదే చెక్అవుట్ ఉపయోగించబడుతుంది."],
    OFFLINE: ["You are offline. Reconnect before saving or placing an order.", "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు. సేవ్ చేయడానికి లేదా ఆర్డర్ చేయడానికి కనెక్ట్ అవ్వండి."],
    ACCOUNT_LOADING: ["Your account is still loading. Wait a moment or retry the connection.", "మీ ఖాతా లోడ్ అవుతోంది. కొద్దిసేపు వేచి ఉండండి లేదా కనెక్షన్ మళ్లీ ప్రయత్నించండి."],
    ACCOUNT_CHANGED: ["Your account changed. Review this page using your current account.", "మీ ఖాతా మారింది. ప్రస్తుత ఖాతాతో ఈ పేజీని సరిచూడండి."],
    CHECKOUT_BUSY: ["Your order is being saved. Wait for its result before changing the cart or signing out.", "మీ ఆర్డర్ సేవ్ అవుతోంది. కార్ట్ మార్చడానికి లేదా సైన్ అవుట్ ముందు ఫలితం కోసం వేచి ఉండండి."],
    CHECKOUT_RECOVERY_UNAVAILABLE: ["Your saved checkout could not be restored. Enable browser storage and try again before starting another order.", "సేవ్ చేసిన చెక్అవుట్‌ను తిరిగి పొందలేకపోయాము. మరో ఆర్డర్ ప్రారంభించే ముందు బ్రౌజర్ నిల్వను అనుమతించి మళ్లీ ప్రయత్నించండి."],
    CHECKOUT_STORAGE_UNAVAILABLE: ["Your browser could not save this checkout for recovery. No order request was sent. Enable browser storage and try again.", "ఈ చెక్అవుట్‌ను మళ్లీ పొందడానికి బ్రౌజర్‌లో సేవ్ చేయలేకపోయాము. ఆర్డర్ అభ్యర్థన పంపబడలేదు. బ్రౌజర్ నిల్వను అనుమతించి మళ్లీ ప్రయత్నించండి."],
    CONFIG_REQUIRED: ["The store connection is not configured. Please contact the business.", "స్టోర్ కనెక్షన్ సిద్ధంగా లేదు. వ్యాపారాన్ని సంప్రదించండి."],
    INVALID_DATA: ["These store details could not be loaded. Retry or contact the business.", "ఈ స్టోర్ వివరాలు లోడ్ కాలేదు. మళ్లీ ప్రయత్నించండి లేదా వ్యాపారాన్ని సంప్రదించండి."],
    UNKNOWN: ["The request could not be completed. Try again or contact the business.", "అభ్యర్థన పూర్తి కాలేదు. మళ్లీ ప్రయత్నించండి లేదా వ్యాపారాన్ని సంప్రదించండి."],
  };
  const message = messages[errorCode(error)] ?? messages.UNKNOWN;
  return t(message[0], message[1]);
}
export function languageText(value: Bilingual, language: Language): string { return value[language]; }
export const DEMO_PRODUCT: Product = {
  published: true, preview: true,
  name: { en: "Ghani groundnut oil", te: "ఘానీ వేరుశెనగ నూనె" },
  description: { en: "Made in a traditional bull-driven wooden Ghani. Choose the right size for your kitchen.", te: "సాంప్రదాయ ఎద్దులతో నడిచే చెక్క ఘానీలో తయారు చేయబడింది. మీ వంటింటికి సరైన పరిమాణం ఎంచుకోండి." },
  ingredients: { en: "Groundnut oil. Finished product facts and label details will be added with the real packaging before launch.", te: "వేరుశెనగ నూనె. తుది ఉత్పత్తి మరియు లేబుల్ వివరాలు ప్రారంభానికి ముందు చేర్చబడతాయి." },
  extraction: { en: "A wooden Ghani, driven by bulls, is the traditional process described by Narayana Naturals.", te: "ఎద్దులతో నడిచే చెక్క ఘానీ నారాయణ నేచురల్స్ సాంప్రదాయ పద్ధతి." },
  storage: { en: "Store in a cool, dry place away from direct sunlight. Follow the final pack label.", te: "నేరుగా సూర్యకాంతి పడని చల్లని, పొడి ప్రదేశంలో ఉంచండి. ప్యాక్ లేబుల్ సూచనలను పాటించండి." },
};
