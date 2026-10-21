import { PACK_IDS, PACK_LITRES, StoreError, validateAddress } from './commerce';
import type { Address, CartLine, DemoOrder, Variant } from './demo';

export type DemoBill = {
  uid: string; quoteId: string; address: Address; lines: DemoOrder['lines'];
  subtotalPaise: number; shippingPaise: 0; totalPaise: number;
  expiresAt: string; sampleOnly: true;
};
export type LocalDemoReceipt = Omit<DemoBill, 'quoteId' | 'expiresAt'> & {
  id: string; createdAt: string; paymentStatus: 'simulated';
  amountCollectedPaise: 0; storage: 'browser';
};
type ReceiptStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function cartQuantityLimit(variant: Variant | undefined, demonstration: boolean): number {
  if (!variant?.enabled || variant.pricePaise <= 0) return 0;
  return demonstration ? 20 : variant.stockConfirmed === false ? 0 : Math.min(20, variant.stock);
}
export function demoReceiptKey(uid: string) { return `nn-private-demo-receipts-v1-${uid}`; }

export function makeDemoBill(uid: string, input: Address, cart: CartLine[], variants: Variant[],
  quoteId: string, now = Date.now()): DemoBill {
  if (!uid) throw new StoreError('AUTH_REQUIRED');
  const address = validateAddress(input);
  if (address.pin !== '517502') throw new StoreError('DEMO_PIN');
  if (!cart.length || cart.length > 3 || new Set(cart.map(line => line.id)).size !== cart.length) throw new StoreError('INVALID_INPUT');
  const lines = cart.map(line => {
    const variant = variants.find(variant => variant.id === line.id);
    if (!PACK_IDS.includes(line.id) || !variant || !Number.isInteger(line.quantity) ||
        line.quantity < 1 || line.quantity > cartQuantityLimit(variant, true)) throw new StoreError('OUT_OF_STOCK');
    return { id: line.id, quantity: line.quantity, litres: variant.litres, unitPricePaise: variant.pricePaise };
  }).sort((a,b) => PACK_IDS.indexOf(a.id) - PACK_IDS.indexOf(b.id));
  const subtotalPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
  return { uid, quoteId, address, lines, subtotalPaise, shippingPaise: 0,
    totalPaise: subtotalPaise, expiresAt: new Date(now + 600_000).toISOString(), sampleOnly: true };
}

export function assertDemoBillCurrent(bill: DemoBill, uid: string, cart: CartLine[], variants: Variant[], now = Date.now()) {
  if (bill.uid !== uid) throw new StoreError('ACCOUNT_CHANGED');
  if (!bill.sampleOnly || bill.shippingPaise !== 0) throw new StoreError('INVALID_DATA');
  if (!Number.isFinite(Date.parse(bill.expiresAt)) || Date.parse(bill.expiresAt) <= now) throw new StoreError('QUOTE_EXPIRED');
  const fresh = makeDemoBill(uid, bill.address, cart, variants, bill.quoteId, now);
  if (fresh.totalPaise !== bill.totalPaise || bill.subtotalPaise !== bill.totalPaise ||
      JSON.stringify(fresh.lines) !== JSON.stringify(bill.lines)) throw new StoreError('QUOTE_CHANGED');
}

export function readDemoReceipts(raw: string | null, uid: string): LocalDemoReceipt[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Map<string, LocalDemoReceipt>();
    for (const entry of parsed.slice(0,50)) {
      if (!entry || typeof entry !== 'object' || entry.uid !== uid ||
          typeof entry.id !== 'string' || !/^NN-DEMO-[A-Za-z0-9_-]{8,100}$/.test(entry.id) ||
          entry.sampleOnly !== true || entry.storage !== 'browser' || entry.paymentStatus !== 'simulated' ||
          entry.amountCollectedPaise !== 0 || entry.shippingPaise !== 0 ||
          typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt)) ||
          !Array.isArray(entry.lines) || !entry.lines.length || entry.lines.length > 3 ||
          new Set(entry.lines.map((line: CartLine) => line?.id)).size !== entry.lines.length) continue;
      const address = validateAddress(entry.address);
      if (address.pin !== '517502' || entry.lines.some((line: DemoOrder['lines'][number]) =>
        !PACK_IDS.includes(line?.id) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20 ||
        line.litres !== PACK_LITRES[line.id] || !Number.isInteger(line.unitPricePaise) || line.unitPricePaise <= 0)) continue;
      const subtotal = entry.lines.reduce((sum: number, line: DemoOrder['lines'][number]) => sum + line.quantity * line.unitPricePaise, 0);
      if (entry.subtotalPaise !== subtotal || entry.totalPaise !== subtotal) continue;
      unique.set(entry.id, { ...entry, address });
    }
    return [...unique.values()].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch { return []; }
}

// This is a local simulation receipt, never a merchant payment verification.
// Returning `created` lets callers clear the shared cart only once.
export function persistDemoReceipt(storage: ReceiptStorage, bill: DemoBill, uid: string, now = Date.now()) {
  if (bill.uid !== uid) throw new StoreError('ACCOUNT_CHANGED');
  const id = `NN-DEMO-${bill.quoteId}`;
  try {
    const receipts = readDemoReceipts(storage.getItem(demoReceiptKey(uid)), uid);
    const existing = receipts.find(receipt => receipt.id === id);
    if (existing) return { receipt: existing, created: false };
    const { quoteId: _quoteId, expiresAt: _expiresAt, ...snapshot } = bill;
    const receipt: LocalDemoReceipt = { ...snapshot, id, createdAt: new Date(now).toISOString(),
      paymentStatus: 'simulated', amountCollectedPaise: 0, storage: 'browser' };
    storage.setItem(demoReceiptKey(uid), JSON.stringify([receipt, ...receipts].slice(0,50)));
    return { receipt, created: true };
  } catch (reason) {
    if (reason instanceof StoreError) throw reason;
    throw new StoreError('LOCAL_STORAGE');
  }
}
