import type { Firestore, Transaction } from 'firebase-admin/firestore';
import {
  VARIANT_LITRES, assertNoLivePreview, assertTransition, calculateTotals, digest, fail, integer,
  parsePlaceRequest, parseQuoteRequest, parseStatusRequest, parseVariantRequest, requireAdmin, requirePhone,
  type Actor, type Address, type Channel, type DeliveryTerms, type Line, type Order, type PackTerms, type QuoteResponse,
} from './model.js';

const QUOTE_LIFETIME_MS = 10 * 60 * 1000;
const WINDOW_MS = 60 * 1000;
interface StoredQuote extends QuoteResponse {
  uid: string; customerPhone: string; createdAt: string; expiresAtMs: number; termsHash: string;
  address: Address; channel: Channel; requestedLines: Line[]; consumedOrderId?: string;
}
export class CommerceService {
  constructor(private readonly db: Firestore, private readonly options: { isEmulator: boolean; now?: () => number }) {}
  private now(): number { return this.options.now?.() ?? Date.now(); }
  private requestRef(uid: string, key: string) { return this.db.doc(`_orderRequests/${digest([uid, key])}`); }

  private async rateLimit(uid: string, operation: 'quote' | 'order'): Promise<void> {
    const ref = this.db.doc(`_checkoutLimits/${digest([uid, operation])}`);
    await this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      const now = this.now();
      const previous = snapshot.data();
      const sameWindow = previous && now - previous.startedAtMs < WINDOW_MS && now >= previous.startedAtMs;
      const count = sameWindow ? previous.count : 0;
      if (count >= (operation === 'quote' ? 10 : 20)) fail('RATE_LIMITED', 'Wait a minute before trying again.', 'resource-exhausted');
      tx.set(ref, { startedAtMs: sameWindow ? previous.startedAtMs : now, count: count + 1 });
    });
  }

  private async currentTerms(tx: Transaction, lines: Line[], pin: string, fromQuote = false) {
    const refs = [this.db.doc('publicContent/storefront'), this.db.doc('products/groundnut-oil'), this.db.doc(`deliveryRules/${pin}`),
      ...lines.map(line => this.db.doc(`products/groundnut-oil/variants/${line.id}`)),
      ...lines.map(line => this.db.doc(`_inventory/${line.id}`))];
    const snapshots = await tx.getAll(...refs);
    const store = snapshots[0]?.data();
    const product = snapshots[1]?.data();
    const rule = snapshots[2]?.data();
    if (!store || store.orderingEnabled !== true || store.onlinePaymentsEnabled !== false || typeof store.preview !== 'boolean') {
      fail('STORE_NOT_READY', 'Ordering is unavailable until the store setup is complete.');
    }
    if (!product || product.published !== true) fail('OUT_OF_STOCK', 'This product is unavailable.');
    if (!rule || rule.enabled !== true) {
      fail(fromQuote ? 'QUOTE_CHANGED' : 'NOT_SERVICEABLE', 'Delivery is unavailable for this PIN. Review a fresh quote.');
    }
    const extraLitrePaise = rule.extraLitrePaise ?? 0;
    const includedLitres = rule.includedLitres ?? 0;
    if (!integer(rule.feePaise, 0, 100_000_000) || !integer(extraLitrePaise, 0, 100_000_000)
      || !integer(includedLitres, 0, 1000) || typeof rule.codAllowed !== 'boolean' || typeof rule.local !== 'boolean'
      || typeof rule.estimate !== 'string' || rule.estimate.length < 1 || rule.estimate.length > 120) {
      fail('STORE_NOT_READY', 'The delivery configuration needs review.');
    }
    const packs: PackTerms[] = lines.map((line, index) => {
      const variant = snapshots[3 + index]?.data();
      const stock = snapshots[3 + lines.length + index]?.data();
      if (!variant || variant.enabled !== true) fail('OUT_OF_STOCK', 'A selected pack is unavailable.');
      if (variant.id !== line.id || variant.litres !== VARIANT_LITRES[line.id] || !integer(variant.pricePaise, 100, 1_000_000)
        || !stock || !integer(stock.availablePacks, 0, 1_000_000_000) || variant.stock !== stock.availablePacks) {
        fail('STORE_NOT_READY', 'The product price or stock configuration needs review.');
      }
      return { id: line.id, litres: variant.litres, pricePaise: variant.pricePaise, stock: stock.availablePacks,
        preview: variant.preview === true || stock.preview === true };
    });
    const delivery: DeliveryTerms = { feePaise: rule.feePaise, extraLitrePaise, includedLitres,
      codAllowed: rule.codAllowed, estimate: rule.estimate, local: rule.local, preview: rule.preview === true };
    const hasPreviewData = assertNoLivePreview(this.options.isEmulator,
      [store.preview, product.preview, delivery.preview, ...packs.map(pack => pack.preview)]);
    const preview = this.options.isEmulator || hasPreviewData;
    const totals = calculateTotals(lines, packs, delivery);
    // Availability is checked on every request; stock changes alone do not change a visible price quote.
    const termsHash = digest({ product: 'groundnut-oil', preview, delivery,
      packs: packs.map(({ id, litres, pricePaise, preview }) => ({ id, litres, pricePaise, preview })) });
    return { ...totals, packs, codAllowed: delivery.codAllowed, estimate: delivery.estimate, preview, termsHash };
  }

  async quoteCheckout(actor: Actor | undefined, raw: unknown): Promise<QuoteResponse> {
    const customer = requirePhone(actor);
    const request = parseQuoteRequest(raw);
    await this.rateLimit(customer.uid, 'quote');
    const ref = this.db.collection('_checkoutQuotes').doc();
    return this.db.runTransaction(async tx => {
      const terms = await this.currentTerms(tx, request.lines, request.address.pin);
      const now = this.now();
      const response: QuoteResponse = { quoteId: ref.id, subtotalPaise: terms.subtotalPaise,
        shippingPaise: terms.shippingPaise, totalPaise: terms.totalPaise, codAllowed: terms.codAllowed,
        estimate: terms.estimate, expiresAt: new Date(now + QUOTE_LIFETIME_MS).toISOString(), preview: terms.preview, lines: terms.lines };
      const quote: StoredQuote = { ...response, uid: customer.uid, customerPhone: customer.phone,
        createdAt: new Date(now).toISOString(), expiresAtMs: now + QUOTE_LIFETIME_MS, termsHash: terms.termsHash,
        address: request.address, channel: request.channel, requestedLines: request.lines };
      tx.create(ref, quote);
      return response;
    });
  }

  async placeCodOrder(actor: Actor | undefined, raw: unknown): Promise<{ orderId: string }> {
    const customer = requirePhone(actor);
    const request = parsePlaceRequest(raw);
    const keyRef = this.requestRef(customer.uid, request.idempotencyKey);
    // Completed retries do not consume rate limits, and remain valid after the quote expires.
    const completed = (await keyRef.get()).data();
    if (completed) {
      if (completed.quoteId !== request.quoteId) fail('IDEMPOTENCY_CONFLICT', 'This retry key belongs to a different quote.', 'already-exists');
      return { orderId: completed.orderId as string };
    }
    await this.rateLimit(customer.uid, 'order');
    const quoteRef = this.db.doc(`_checkoutQuotes/${request.quoteId}`);
    const orderRef = this.db.collection('orders').doc();
    return this.db.runTransaction(async tx => {
      const [keySnapshot, quoteSnapshot] = await tx.getAll(keyRef, quoteRef);
      const existing = keySnapshot!.data();
      if (existing) {
        if (existing.quoteId !== request.quoteId) fail('IDEMPOTENCY_CONFLICT', 'This retry key belongs to a different quote.', 'already-exists');
        return { orderId: existing.orderId as string };
      }
      if (!quoteSnapshot!.exists) fail('QUOTE_NOT_FOUND', 'This checkout quote is missing.', 'not-found');
      const quote = quoteSnapshot!.data() as StoredQuote;
      if (quote.uid !== customer.uid) fail('QUOTE_OWNER_MISMATCH', 'This quote belongs to another account.', 'permission-denied');
      if (quote.consumedOrderId) {
        tx.create(keyRef, { uid: customer.uid, quoteId: quote.quoteId, orderId: quote.consumedOrderId, createdAt: new Date(this.now()).toISOString() });
        return { orderId: quote.consumedOrderId };
      }
      if (this.now() >= quote.expiresAtMs) fail('QUOTE_EXPIRED', 'Review a fresh quote before ordering.');
      const terms = await this.currentTerms(tx, quote.requestedLines, quote.address.pin, true);
      if (this.now() >= quote.expiresAtMs) fail('QUOTE_EXPIRED', 'Review a fresh quote before ordering.');
      if (terms.termsHash !== quote.termsHash || quote.customerPhone !== customer.phone) {
        fail('QUOTE_CHANGED', 'Prices or delivery details changed. Review a fresh quote.');
      }
      if (!terms.codAllowed) fail('COD_UNAVAILABLE', 'Cash on delivery is unavailable for this PIN.');
      const now = new Date(this.now()).toISOString();
      const order: Order = { id: orderRef.id, uid: customer.uid, customerPhone: customer.phone, createdAt: now,
        lines: terms.lines, address: quote.address, subtotalPaise: terms.subtotalPaise, shippingPaise: terms.shippingPaise,
        totalPaise: terms.totalPaise, paymentMethod: 'cod', paymentStatus: 'pending_collection', status: 'received',
        channel: quote.channel, preview: terms.preview };
      // Every read precedes every write. Firestore retries this callback against current stock on contention.
      for (const line of terms.lines) {
        const pack = terms.packs.find(pack => pack.id === line.id)!;
        const availablePacks = pack.stock - line.quantity;
        tx.update(this.db.doc(`_inventory/${line.id}`), { availablePacks, updatedAt: now });
        tx.update(this.db.doc(`products/groundnut-oil/variants/${line.id}`), { stock: availablePacks });
      }
      tx.create(orderRef, order);
      tx.create(keyRef, { uid: customer.uid, quoteId: quote.quoteId, orderId: orderRef.id, createdAt: now });
      tx.update(quoteRef, { consumedOrderId: orderRef.id });
      return { orderId: orderRef.id };
    });
  }

  async updateVariant(actor: Actor | undefined, raw: unknown): Promise<{ id: string }> {
    requireAdmin(actor);
    const request = parseVariantRequest(raw);
    const variantRef = this.db.doc(`products/groundnut-oil/variants/${request.id}`);
    const inventoryRef = this.db.doc(`_inventory/${request.id}`);
    await this.db.runTransaction(async tx => {
      const [product, variant, inventory] = await tx.getAll(this.db.doc('products/groundnut-oil'), variantRef, inventoryRef);
      if (!product?.exists) fail('STORE_NOT_READY', 'Create the product configuration first.');
      const preview = product.data()?.preview === true || variant?.data()?.preview === true || inventory?.data()?.preview === true;
      tx.set(variantRef, { ...request, litres: VARIANT_LITRES[request.id], ...(preview ? { preview: true } : {}) }, { merge: true });
      tx.set(inventoryRef, { availablePacks: request.stock, updatedAt: new Date(this.now()).toISOString(), preview }, { merge: true });
    });
    return { id: request.id };
  }

  async updateOrderStatus(actor: Actor | undefined, raw: unknown): Promise<{ orderId: string; status: string }> {
    requireAdmin(actor);
    const request = parseStatusRequest(raw);
    const ref = this.db.doc(`orders/${request.orderId}`);
    return this.db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) fail('ORDER_NOT_FOUND', 'This order is missing.', 'not-found');
      const order = snapshot.data() as Order;
      assertTransition(order.status, request.status);
      if (order.status === request.status) return request;
      const now = new Date(this.now()).toISOString();
      if (request.status === 'cancelled') {
        const refs = order.lines.flatMap(line => [this.db.doc(`_inventory/${line.id}`), this.db.doc(`products/groundnut-oil/variants/${line.id}`)]);
        const stocks = await tx.getAll(...refs);
        for (const [index, line] of order.lines.entries()) {
          const inventory = stocks[index * 2]?.data();
          if (!integer(inventory?.availablePacks, 0, 1_000_000_000) || !stocks[index * 2 + 1]?.exists) {
            fail('STORE_NOT_READY', 'The packed stock configuration needs review.');
          }
          const availablePacks = inventory.availablePacks + line.quantity;
          tx.update(refs[index * 2]!, { availablePacks, updatedAt: now });
          tx.update(refs[index * 2 + 1]!, { stock: availablePacks });
        }
      }
      tx.update(ref, { status: request.status, updatedAt: now,
        paymentStatus: request.status === 'delivered' ? 'collected' : request.status === 'cancelled' ? 'cancelled' : 'pending_collection' });
      return request;
    });
  }
}
