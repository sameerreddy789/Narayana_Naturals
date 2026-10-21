import { randomUUID } from 'node:crypto';
import type { Database } from 'firebase-admin/database';
import { commerceRoot, parseStoreStage, type StoreStage } from './config.js';
import {
  ApiError, VARIANT_LITRES, assertNoLivePreview, assertTransition, calculateTotals, digest, fail, integer,
  parsePlaceRequest, parseQuoteRequest, parseStatusRequest, parseVariantRequest, requireAdmin, requireEmail, requireStageAccess,
  type Actor, type Address, type Channel, type DeliveryTerms, type Line, type Order, type PackTerms, type QuoteResponse,
} from './model.js';

const QUOTE_LIFETIME_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
interface StoredQuote extends QuoteResponse {
  uid: string; createdAt: number; termsHash: string; address: Address; channel: Channel;
  requestedLines: Line[]; consumedOrderId?: string;
}
interface Receipt { uid: string; quoteId: string; orderId: string; createdAt: number }
interface Limit { startedAt: number; count: number }
interface Ledger {
  products?: Record<string, Record<string, unknown>>;
  variants?: Record<string, Record<string, unknown>>;
  publicContent?: { storefront?: Record<string, unknown> };
  deliveryRules?: Record<string, Record<string, unknown>>;
  ordersByUser?: Record<string, Record<string, Order>>;
  orderIndex?: Record<string, Order>;
  quotes?: Record<string, StoredQuote>;
  idempotency?: Record<string, Receipt>;
  limits?: Record<string, Limit>;
}
interface Options {
  isEmulator: boolean; stage?: StoreStage; now?: () => number; maxOrders?: number; maxReceipts?: number; maxBytes?: number;
}

// The single commerce transaction makes stock, terms, deduplication and both
// order views atomic. It is deliberately bounded for the initial small store.
// Expired unconsumed quotes can be pruned; completed receipts are never evicted.
export class CommerceService {
  readonly stage: StoreStage;
  readonly commerceRoot: 'commerceDraft' | 'commerce';
  constructor(private readonly db: Database, private readonly options: Options) {
    this.stage = parseStoreStage(options.stage);
    this.commerceRoot = commerceRoot(this.stage);
  }
  private assertPreview(markers: unknown[]): boolean {
    return assertNoLivePreview(this.options.isEmulator, markers, this.stage);
  }
  private async completedOrder(orderId: string, uid: string): Promise<{ orderId: string }> {
    const order = (await this.db.ref(`${this.commerceRoot}/orderIndex/${orderId}`).get()).val() as Order | null;
    if (!order || order.uid !== uid) fail('STORE_NOT_READY', 'The saved order records need review.');
    this.assertPreview([order.preview]);
    return { orderId };
  }
  private now(): number { return this.options.now?.() ?? Date.now(); }
  private prune(ledger: Ledger): void {
    const now = this.now();
    for (const [key, quote] of Object.entries(ledger.quotes ?? {})) {
      if (!quote.consumedOrderId && quote.expiresAt + QUOTE_LIFETIME_MS <= now) delete ledger.quotes![key];
    }
    for (const [key, limit] of Object.entries(ledger.limits ?? {})) {
      if (limit.startedAt + 60 * RATE_WINDOW_MS < now) delete ledger.limits![key];
    }
  }
  private capacity(ledger: Ledger): void {
    if (Object.keys(ledger.orderIndex ?? {}).length > (this.options.maxOrders ?? 500)
      || Object.keys(ledger.idempotency ?? {}).length > (this.options.maxReceipts ?? 2000)
      || Object.keys(ledger.quotes ?? {}).length > 750
      || Object.keys(ledger.limits ?? {}).length > 1000
      || Buffer.byteLength(JSON.stringify(ledger), 'utf8') > (this.options.maxBytes ?? 4 * 1024 * 1024)) {
      fail('STORE_CAPACITY', 'The store needs a capacity upgrade. Existing orders and retry receipts are preserved.', 'resource-exhausted');
    }
  }
  private rate(ledger: Ledger, uid: string, operation: 'quote' | 'order' | 'owner'): void {
    const limits = ledger.limits ??= {};
    const key = digest([uid, operation]);
    const now = this.now();
    const previous = limits[key];
    const sameWindow = previous && now >= previous.startedAt && now - previous.startedAt < RATE_WINDOW_MS;
    const count = sameWindow ? previous.count : 0;
    const maximum = operation === 'quote' ? 10 : operation === 'order' ? 20 : 60;
    if (count >= maximum) fail('RATE_LIMITED', 'Wait a minute before trying again.', 'resource-exhausted');
    limits[key] = { startedAt: sameWindow ? previous.startedAt : now, count: count + 1 };
  }
  private async transaction<T>(change: (ledger: Ledger) => T): Promise<T> {
    const reference = this.db.ref(this.commerceRoot);
    // Keep a value listener until commit so the initial callback has the
    // current server value, rather than rejecting a guessed empty cache.
    const listener = () => {};
    reference.on('value', listener);
    let output: T | undefined;
    let failure: unknown;
    try {
      await reference.once('value');
      const result = await reference.transaction(value => {
        failure = undefined;
        output = undefined;
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          failure = new ApiError('STORE_NOT_READY', 'Store configuration is missing.');
          return undefined;
        }
        try {
          const ledger = value as Ledger;
          this.prune(ledger);
          output = change(ledger);
          this.capacity(ledger);
          return ledger;
        } catch (error) {
          failure = error;
          return undefined;
        }
      }, undefined, false);
      if (failure) throw failure;
      if (!result.committed || output === undefined) fail('UNAVAILABLE', 'The store could not save this request. Retry the same request.');
      return output;
    } finally { reference.off('value', listener); }
  }
  private currentTerms(ledger: Ledger, lines: Line[], pin: string, fromQuote = false) {
    const store = ledger.publicContent?.storefront;
    const product = ledger.products?.['groundnut-oil'];
    const rule = ledger.deliveryRules?.[pin];
    if (!store || store.orderingEnabled !== true || store.onlinePaymentsEnabled !== false || typeof store.preview !== 'boolean') {
      fail('STORE_NOT_READY', 'Ordering is unavailable until the store setup is complete.');
    }
    if (!product || product.published !== true) fail('OUT_OF_STOCK', 'This product is unavailable.');
    if (!rule || rule.enabled !== true) fail(fromQuote ? 'QUOTE_CHANGED' : 'NOT_SERVICEABLE', 'Delivery is unavailable for this PIN.');
    const extraLitrePaise = rule.extraLitrePaise ?? 0;
    const includedLitres = rule.includedLitres ?? 0;
    if (!integer(rule.feePaise, 0, 100_000_000) || !integer(extraLitrePaise, 0, 100_000_000)
      || !integer(includedLitres, 0, 1000) || typeof rule.codAllowed !== 'boolean' || typeof rule.local !== 'boolean'
      || typeof rule.estimate !== 'string' || rule.estimate.length < 1 || rule.estimate.length > 120) {
      fail('STORE_NOT_READY', 'The delivery configuration needs review.');
    }
    const packs: PackTerms[] = lines.map(line => {
      const variant = ledger.variants?.[line.id];
      if (!variant || variant.enabled !== true) fail('OUT_OF_STOCK', 'A selected pack is unavailable.');
      if (variant.id !== line.id || variant.litres !== VARIANT_LITRES[line.id] || !integer(variant.pricePaise, 100, 1_000_000)
        || !integer(variant.stock, 0, 1_000_000_000)) fail('STORE_NOT_READY', 'The price or stock configuration needs review.');
      return { id: line.id, litres: VARIANT_LITRES[line.id], pricePaise: variant.pricePaise, stock: variant.stock, preview: variant.preview === true };
    });
    const delivery: DeliveryTerms = { feePaise: rule.feePaise, extraLitrePaise, includedLitres,
      codAllowed: rule.codAllowed, estimate: rule.estimate, local: rule.local, preview: rule.preview === true };
    const marked = this.assertPreview([store.preview, store.stage === 'private-draft', store.testOnly, product.preview,
      delivery.preview, ...packs.map(pack => pack.preview)]);
    const preview = this.options.isEmulator || this.stage === 'private-draft' || marked;
    const totals = calculateTotals(lines, packs, delivery);
    const termsHash = digest({ product: 'groundnut-oil', preview, delivery,
      packs: packs.map(({ id, litres, pricePaise, preview }) => ({ id, litres, pricePaise, preview })) });
    return { ...totals, packs, preview, termsHash, codAllowed: delivery.codAllowed, estimate: delivery.estimate };
  }
  async quoteCheckout(actor: Actor | undefined, raw: unknown): Promise<QuoteResponse> {
    const customer = requireEmail(actor);
    requireStageAccess(customer, this.stage);
    const request = parseQuoteRequest(raw);
    const quoteId = randomUUID();
    return this.transaction(ledger => {
      if (Object.keys(ledger.orderIndex ?? {}).length >= (this.options.maxOrders ?? 500)) {
        fail('STORE_CAPACITY', 'The store needs a capacity upgrade before accepting new orders.', 'resource-exhausted');
      }
      this.rate(ledger, customer.uid, 'quote');
      const terms = this.currentTerms(ledger, request.lines, request.address.pin);
      const now = this.now();
      const response: QuoteResponse = { quoteId, subtotalPaise: terms.subtotalPaise, shippingPaise: terms.shippingPaise,
        totalPaise: terms.totalPaise, codAllowed: terms.codAllowed, estimate: terms.estimate,
        expiresAt: now + QUOTE_LIFETIME_MS, preview: terms.preview, lines: terms.lines };
      (ledger.quotes ??= {})[quoteId] = { ...response, uid: customer.uid, createdAt: now, termsHash: terms.termsHash,
        address: request.address, channel: request.channel, requestedLines: request.lines };
      return response;
    });
  }
  async placeCodOrder(actor: Actor | undefined, raw: unknown): Promise<{ orderId: string }> {
    const customer = requireEmail(actor);
    requireStageAccess(customer, this.stage);
    const request = parsePlaceRequest(raw);
    const hash = digest([customer.uid, request.idempotencyKey]);
    const completed = (await this.db.ref(`${this.commerceRoot}/idempotency/${hash}`).get()).val() as Receipt | null;
    if (completed) {
      if (completed.quoteId !== request.quoteId) fail('IDEMPOTENCY_CONFLICT', 'This retry key belongs to a different quote.', 'already-exists');
      return this.completedOrder(completed.orderId, customer.uid);
    }
    const orderId = randomUUID();
    return this.transaction(ledger => {
      const receipts = ledger.idempotency ??= {};
      const previous = receipts[hash];
      if (previous) {
        if (previous.quoteId !== request.quoteId) fail('IDEMPOTENCY_CONFLICT', 'This retry key belongs to a different quote.', 'already-exists');
        const existing = ledger.orderIndex?.[previous.orderId];
        if (!existing || existing.uid !== customer.uid) fail('STORE_NOT_READY', 'The saved order records need review.');
        this.assertPreview([existing.preview]);
        return { orderId: previous.orderId };
      }
      const quote = ledger.quotes?.[request.quoteId];
      if (!quote) fail('QUOTE_NOT_FOUND', 'This checkout quote is missing or expired.', 'not-found');
      if (quote.uid !== customer.uid) fail('QUOTE_OWNER_MISMATCH', 'This checkout belongs to another account.', 'permission-denied');
      this.assertPreview([quote.preview]);
      if (quote.consumedOrderId) {
        const existing = ledger.orderIndex?.[quote.consumedOrderId];
        if (!existing || existing.uid !== customer.uid) fail('STORE_NOT_READY', 'The saved order records need review.');
        this.assertPreview([existing.preview]);
        receipts[hash] = { uid: customer.uid, quoteId: quote.quoteId, orderId: quote.consumedOrderId, createdAt: this.now() };
        return { orderId: quote.consumedOrderId };
      }
      this.rate(ledger, customer.uid, 'order');
      if (this.now() >= quote.expiresAt) fail('QUOTE_EXPIRED', 'Review a fresh quote before ordering.');
      const terms = this.currentTerms(ledger, quote.requestedLines, quote.address.pin, true);
      if (this.now() >= quote.expiresAt) fail('QUOTE_EXPIRED', 'Review a fresh quote before ordering.');
      if (terms.termsHash !== quote.termsHash) fail('QUOTE_CHANGED', 'Prices or delivery terms changed. Review a fresh quote.');
      if (!terms.codAllowed) fail('COD_UNAVAILABLE', 'Cash on delivery is unavailable for this PIN.');
      const now = this.now();
      const order: Order = { id: orderId, uid: customer.uid, customerPhone: `+91${quote.address.phone}`, createdAt: now,
        lines: terms.lines, address: quote.address, subtotalPaise: terms.subtotalPaise, shippingPaise: terms.shippingPaise,
        totalPaise: terms.totalPaise, paymentMethod: 'cod', paymentStatus: 'pending_collection', status: 'received',
        channel: quote.channel, preview: terms.preview };
      for (const line of terms.lines) ledger.variants![line.id]!.stock = terms.packs.find(pack => pack.id === line.id)!.stock - line.quantity;
      (ledger.orderIndex ??= {})[orderId] = order;
      ((ledger.ordersByUser ??= {})[customer.uid] ??= {})[orderId] = { ...order };
      receipts[hash] = { uid: customer.uid, quoteId: quote.quoteId, orderId, createdAt: now };
      quote.consumedOrderId = orderId;
      return { orderId };
    });
  }
  async updateVariant(actor: Actor | undefined, raw: unknown): Promise<{ id: string }> {
    const owner = requireAdmin(actor);
    requireStageAccess(owner, this.stage);
    const request = parseVariantRequest(raw);
    return this.transaction(ledger => {
      this.rate(ledger, owner.uid, 'owner');
      const product = ledger.products?.['groundnut-oil'];
      if (!product) fail('STORE_NOT_READY', 'Create the product configuration first.');
      const previous = ledger.variants?.[request.id];
      this.assertPreview([product.preview, previous?.preview]);
      (ledger.variants ??= {})[request.id] = { ...previous, ...request, litres: VARIANT_LITRES[request.id],
        preview: product.preview === true || previous?.preview === true };
      return { id: request.id };
    });
  }
  async updateOrderStatus(actor: Actor | undefined, raw: unknown): Promise<{ orderId: string; status: string }> {
    const owner = requireAdmin(actor);
    requireStageAccess(owner, this.stage);
    const request = parseStatusRequest(raw);
    return this.transaction(ledger => {
      const order = ledger.orderIndex?.[request.orderId];
      if (!order) fail('ORDER_NOT_FOUND', 'This order is missing.', 'not-found');
      this.assertPreview([order.preview]);
      assertTransition(order.status, request.status);
      if (order.status === request.status) return request;
      this.rate(ledger, owner.uid, 'owner');
      const customerCopy = ledger.ordersByUser?.[order.uid]?.[order.id];
      if (!customerCopy || customerCopy.status !== order.status) fail('STORE_NOT_READY', 'The order records need review.');
      if (request.status === 'cancelled') {
        for (const line of order.lines) {
          const variant = ledger.variants?.[line.id];
          if (!variant || !integer(variant.stock, 0, 1_000_000_000 - line.quantity)) fail('STORE_NOT_READY', 'The stock configuration needs review.');
          variant.stock += line.quantity;
        }
      }
      const updated: Order = { ...order, status: request.status, updatedAt: this.now(),
        paymentStatus: request.status === 'delivered' ? 'collected' : request.status === 'cancelled' ? 'cancelled' : 'pending_collection' };
      ledger.orderIndex![order.id] = updated;
      ledger.ordersByUser![order.uid]![order.id] = { ...updated };
      return request;
    });
  }
}
