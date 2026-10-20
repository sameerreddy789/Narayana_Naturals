export type Language = "en" | "te";
export type PackId = "1l" | "2l" | "5l";
export type Variant = { id: PackId; litres: number; pricePaise: number; stock: number; enabled: boolean; preview?: boolean };
export type CartLine = { id: PackId; quantity: number };
export type DemoUser = { uid: string; name: string; phone: string; email?: string; admin: boolean };
export type Address = { name: string; phone: string; street: string; city: string; pin: string };
export type DemoOrder = {
  id: string;
  uid: string;
  customerPhone: string;
  createdAt: string;
  lines: (CartLine & { litres: number; unitPricePaise: number })[];
  address: Address;
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  paymentMethod: "cod";
  paymentStatus: "pending_collection" | "collected" | "cancelled";
  status: "received" | "packed" | "shipped" | "delivered" | "cancelled";
  channel: "web" | "android";
  preview: boolean;
};
export type PreviewState = {
  language: Language;
  user: DemoUser | null;
  cart: CartLine[];
  variants: Variant[];
  orders: DemoOrder[];
  welcomeSeen: string[];
  dismissedTips: Record<string, string[]>;
  addresses: Record<string, Address>;
};

export const DEFAULT_VARIANTS: Variant[] = [
  { id: "1l", litres: 1, pricePaise: 45000, stock: 24, enabled: true, preview: true },
  { id: "2l", litres: 2, pricePaise: 90000, stock: 18, enabled: true, preview: true },
  { id: "5l", litres: 5, pricePaise: 225000, stock: 10, enabled: true, preview: true },
];

export function initialPreview(): PreviewState {
  return { language: "en", user: null, cart: [], variants: DEFAULT_VARIANTS.map(v => ({ ...v })), orders: [], welcomeSeen: [], dismissedTips: {}, addresses: {} };
}

export function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(paise / 100);
}

export function cartSubtotal(cart: CartLine[], variants: Variant[]) {
  return cart.reduce((sum, line) => sum + (variants.find(v => v.id === line.id)?.pricePaise ?? 0) * line.quantity, 0);
}

export const SAMPLE_PINS: Record<string, { city: string; local: boolean }> = {
  "517001": { city: "Chittoor", local: true },
  "517501": { city: "Tirupati", local: true },
  "560001": { city: "Bengaluru", local: false },
  "500001": { city: "Hyderabad", local: false },
  "600001": { city: "Chennai", local: false },
  "110001": { city: "New Delhi", local: false },
  "400001": { city: "Mumbai", local: false },
};

export function deliveryQuote(pin: string, cart: CartLine[], variants: Variant[]) {
  const area = SAMPLE_PINS[pin];
  if (!area) return null;
  const litres = cart.reduce((sum, line) => sum + (variants.find(v => v.id === line.id)?.litres ?? 0) * line.quantity, 0);
  return { ...area, feePaise: area.local ? 4000 : 12000 + Math.max(0, litres - 2) * 2000, estimate: area.local ? "1–2 days" : "3–7 days", codAllowed: area.local };
}

export function isIndianMobile(phone: string) {
  return /^[6-9]\d{9}$/.test(phone);
}

export function readPreview(raw: string | null): PreviewState {
  const fresh = initialPreview();
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as Partial<PreviewState>;
    if (!parsed || typeof parsed !== "object") return fresh;
    const variants = Array.isArray(parsed.variants) && parsed.variants.length === 3
      && parsed.variants.every((v, i) => v.id === DEFAULT_VARIANTS[i].id && v.litres === DEFAULT_VARIANTS[i].litres && Number.isInteger(v.pricePaise) && v.pricePaise > 0 && Number.isInteger(v.stock) && v.stock >= 0)
      ? parsed.variants.map(v => ({ ...v, enabled: v.enabled !== false, preview: true })) : fresh.variants;
    const cart = Array.isArray(parsed.cart) ? parsed.cart.filter(line => line && variants.some(v => v.id === line.id) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 20).filter((line, i, all) => all.findIndex(v => v.id === line.id) === i) : [];
    const emailUser = parsed.user && typeof parsed.user.name === "string" && typeof parsed.user.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.user.email) && /^demo_[a-f0-9]{24}$/.test(parsed.user.uid);
    const user = emailUser ? { ...parsed.user!, phone: parsed.user!.phone || "", admin: false } : parsed.user && typeof parsed.user.name === "string" && typeof parsed.user.phone === "string" && isIndianMobile(parsed.user.phone) ? { ...parsed.user, uid: `demo_${parsed.user.phone}`, admin: false } : null;
    const orders = Array.isArray(parsed.orders) ? parsed.orders.filter(order => order && typeof order.id === "string" && typeof order.customerPhone === "string" && typeof order.createdAt === "string" && Number.isFinite(Date.parse(order.createdAt)) && Array.isArray(order.lines) && order.lines.every(line => line && variants.some(v => v.id === line.id) && Number.isInteger(line.quantity) && line.quantity > 0 && Number.isInteger(line.unitPricePaise) && line.unitPricePaise > 0) && order.address && typeof order.address.street === "string" && typeof order.address.name === "string" && typeof order.address.pin === "string" && Number.isInteger(order.totalPaise) && Number.isInteger(order.subtotalPaise) && Number.isInteger(order.shippingPaise) && ["cod", "online"].includes(order.paymentMethod) && ["received", "packed", "shipped", "delivered", "cancelled"].includes(order.status)) : [];
    const demoKey = (key: string) => isIndianMobile(key) ? `demo_${key}` : key;
    const dismissedTips = parsed.dismissedTips && typeof parsed.dismissedTips === "object" && !Array.isArray(parsed.dismissedTips) ? Object.fromEntries(Object.entries(parsed.dismissedTips).filter(([key, tips]) => /^demo_(?:[6-9]\d{9}|[a-f0-9]{24})$/.test(demoKey(key)) && Array.isArray(tips) && tips.every(tip => typeof tip === "string")).map(([key, tips]) => [demoKey(key), tips])) : {};
    const addresses = parsed.addresses && typeof parsed.addresses === "object" && !Array.isArray(parsed.addresses) ? Object.fromEntries(Object.entries(parsed.addresses).filter(([key, address]) => /^demo_(?:[6-9]\d{9}|[a-f0-9]{24})$/.test(demoKey(key)) && address && typeof address.name === "string" && typeof address.street === "string" && typeof address.city === "string" && typeof address.pin === "string" && typeof address.phone === "string").map(([key, address]) => [demoKey(key), address])) : {};
    const validOrders = orders.filter(order => order.paymentMethod === "cod").map(order => ({ ...order, uid: /^demo_[a-f0-9]{24}$/.test(order.uid) ? order.uid : `demo_${order.customerPhone.replace(/^\+91/, "")}`, customerPhone: `+91${order.customerPhone.replace(/^\+91/, "")}`, paymentStatus: order.status === "delivered" ? "collected" as const : order.status === "cancelled" ? "cancelled" as const : "pending_collection" as const, channel: "web" as const, preview: true }));
    return { language: parsed.language === "te" ? "te" : "en", user, cart, variants, orders: validOrders, welcomeSeen: Array.isArray(parsed.welcomeSeen) ? parsed.welcomeSeen.filter(v => typeof v === "string").map(demoKey) : [], dismissedTips, addresses };
  } catch { return fresh; }
}
