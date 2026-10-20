import { createHash } from 'node:crypto';
import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

export const VARIANT_LITRES = { '1l': 1, '2l': 2, '5l': 5 } as const;
export type VariantId = keyof typeof VARIANT_LITRES;
export type Channel = 'web' | 'android';
export type OrderStatus = 'received' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export interface Actor { uid: string; token: Record<string, unknown> }
export interface Line { id: VariantId; quantity: number }
export interface Address { name: string; phone: string; street: string; city: string; pin: string }
export interface OrderLine extends Line { litres: number; unitPricePaise: number }
export interface QuoteRequest { lines: Line[]; address: Address; channel: Channel }
export interface QuoteResponse {
  quoteId: string; subtotalPaise: number; shippingPaise: number; totalPaise: number;
  codAllowed: boolean; estimate: string; expiresAt: string; preview: boolean; lines: OrderLine[];
}
export interface Order {
  id: string; uid: string; customerPhone: string; createdAt: string; lines: OrderLine[];
  address: Address; subtotalPaise: number; shippingPaise: number; totalPaise: number;
  paymentMethod: 'cod'; paymentStatus: 'pending_collection' | 'collected' | 'cancelled';
  status: OrderStatus; channel: Channel; preview: boolean; updatedAt?: string;
}
export type MachineCode = 'AUTH_REQUIRED' | 'PHONE_REQUIRED' | 'ADMIN_REQUIRED' | 'INVALID_INPUT'
  | 'STORE_NOT_READY' | 'NOT_SERVICEABLE' | 'OUT_OF_STOCK' | 'QUOTE_EXPIRED' | 'QUOTE_CHANGED'
  | 'QUOTE_NOT_FOUND' | 'QUOTE_OWNER_MISMATCH' | 'COD_UNAVAILABLE' | 'IDEMPOTENCY_CONFLICT'
  | 'ORDER_NOT_FOUND' | 'INVALID_TRANSITION' | 'RATE_LIMITED';

export function fail(code: MachineCode, message: string, native: FunctionsErrorCode = 'failed-precondition'): never {
  throw new HttpsError(native, message, { code });
}
export function requireActor(actor: Actor | undefined): Actor {
  if (!actor?.uid) fail('AUTH_REQUIRED', 'Sign in before continuing.', 'unauthenticated');
  return actor;
}
export function requirePhone(actor: Actor | undefined): Actor & { phone: string } {
  const signedIn = requireActor(actor);
  const phone = signedIn.token.phone_number;
  if (typeof phone !== 'string' || !/^\+91[6-9][0-9]{9}$/.test(phone)) {
    fail('PHONE_REQUIRED', 'Verify an Indian mobile number before checkout.', 'failed-precondition');
  }
  return { ...signedIn, phone };
}
export function requireAdmin(actor: Actor | undefined): Actor {
  const signedIn = requireActor(actor);
  if (signedIn.token.admin !== true) fail('ADMIN_REQUIRED', 'Owner access is required.', 'permission-denied');
  return signedIn;
}
export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', 'Expected an object.', 'invalid-argument');
  }
  return value as Record<string, unknown>;
}
export function exactKeys(value: unknown, keys: string[]): Record<string, unknown> {
  const data = record(value);
  if (Object.keys(data).length !== keys.length || !keys.every(key => Object.hasOwn(data, key))) {
    fail('INVALID_INPUT', 'Unexpected or missing fields.', 'invalid-argument');
  }
  return data;
}
export function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
export function variantId(value: unknown): VariantId {
  if (typeof value !== 'string' || !Object.hasOwn(VARIANT_LITRES, value)) {
    fail('INVALID_INPUT', 'Choose a valid pack.', 'invalid-argument');
  }
  return value as VariantId;
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    fail('INVALID_INPUT', 'Invalid identifier.', 'invalid-argument');
  }
  return value;
}
function textField(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') fail('INVALID_INPUT', 'Invalid address.', 'invalid-argument');
  const normalized = value.trim().normalize('NFC');
  if (normalized.length < min || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    fail('INVALID_INPUT', 'Invalid address.', 'invalid-argument');
  }
  return normalized;
}
export function parseLines(value: unknown): Line[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    fail('INVALID_INPUT', 'Choose between one and three packs.', 'invalid-argument');
  }
  const seen = new Set<VariantId>();
  const lines = value.map(entry => {
    const data = exactKeys(entry, ['id', 'quantity']);
    const id = variantId(data.id);
    if (seen.has(id) || !integer(data.quantity, 1, 20)) {
      fail('INVALID_INPUT', 'Pack quantities must be unique and between 1 and 20.', 'invalid-argument');
    }
    seen.add(id);
    return { id, quantity: data.quantity };
  });
  return lines.sort((a, b) => a.id.localeCompare(b.id));
}
export function parseAddress(value: unknown): Address {
  const data = exactKeys(value, ['name', 'phone', 'street', 'city', 'pin']);
  if (typeof data.phone !== 'string' || !/^[6-9][0-9]{9}$/.test(data.phone)
    || typeof data.pin !== 'string' || !/^[1-9][0-9]{5}$/.test(data.pin)) {
    fail('INVALID_INPUT', 'Enter a valid Indian phone and PIN.', 'invalid-argument');
  }
  return { name: textField(data.name, 2, 100), phone: data.phone,
    street: textField(data.street, 5, 300), city: textField(data.city, 2, 100), pin: data.pin };
}
export function parseQuoteRequest(value: unknown): QuoteRequest {
  const data = exactKeys(value, ['lines', 'address', 'channel']);
  if (data.channel !== 'web' && data.channel !== 'android') fail('INVALID_INPUT', 'Invalid channel.', 'invalid-argument');
  return { lines: parseLines(data.lines), address: parseAddress(data.address), channel: data.channel };
}
export function parsePlaceRequest(value: unknown): { quoteId: string; idempotencyKey: string } {
  const data = exactKeys(value, ['quoteId', 'idempotencyKey']);
  return { quoteId: identifier(data.quoteId), idempotencyKey: identifier(data.idempotencyKey) };
}
export function parseVariantRequest(value: unknown): { id: VariantId; pricePaise: number; stock: number; enabled: boolean } {
  const data = exactKeys(value, ['id', 'pricePaise', 'stock', 'enabled']);
  const id = variantId(data.id);
  if (!integer(data.pricePaise, 100, 1_000_000) || !integer(data.stock, 0, 100_000) || typeof data.enabled !== 'boolean') {
    fail('INVALID_INPUT', 'Invalid price, packed stock, or availability.', 'invalid-argument');
  }
  return { id, pricePaise: data.pricePaise, stock: data.stock, enabled: data.enabled };
}
export function parseStatusRequest(value: unknown): { orderId: string; status: OrderStatus } {
  const data = exactKeys(value, ['orderId', 'status']);
  const orderId = identifier(data.orderId);
  if (typeof data.status !== 'string' || !['received', 'packed', 'shipped', 'delivered', 'cancelled'].includes(data.status)) {
    fail('INVALID_INPUT', 'Invalid order status.', 'invalid-argument');
  }
  return { orderId, status: data.status as OrderStatus };
}
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    received: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [],
  };
  if (from !== to && !transitions[from]?.includes(to)) fail('INVALID_TRANSITION', 'This order status cannot be changed that way.');
}
export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export interface PackTerms { id: VariantId; litres: number; pricePaise: number; stock: number; preview: boolean }
export interface DeliveryTerms {
  feePaise: number; extraLitrePaise: number; includedLitres: number;
  codAllowed: boolean; estimate: string; local: boolean; preview: boolean;
}
export function calculateTotals(lines: Line[], packs: PackTerms[], delivery: DeliveryTerms) {
  const orderLines = lines.map(line => {
    const pack = packs.find(pack => pack.id === line.id);
    if (!pack || pack.stock < line.quantity) fail('OUT_OF_STOCK', 'A selected pack is no longer available.');
    return { ...line, litres: pack.litres, unitPricePaise: pack.pricePaise };
  });
  const subtotalPaise = orderLines.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);
  const totalLitres = orderLines.reduce((sum, line) => sum + line.quantity * line.litres, 0);
  const shippingPaise = delivery.feePaise + Math.max(0, totalLitres - delivery.includedLitres) * delivery.extraLitrePaise;
  const totalPaise = subtotalPaise + shippingPaise;
  if (![subtotalPaise, shippingPaise, totalPaise].every(value => integer(value, 0, 100_000_000))) {
    fail('STORE_NOT_READY', 'The delivery or price configuration needs review.');
  }
  return { lines: orderLines, subtotalPaise, shippingPaise, totalPaise };
}
export function assertNoLivePreview(isEmulator: boolean, markers: unknown[]): boolean {
  if (!isEmulator && markers.some(marker => marker === true)) {
    fail('STORE_NOT_READY', 'Preview data cannot accept live orders.');
  }
  return markers.some(marker => marker === true);
}
