import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { CommerceService } from '../src/commerce.js';
import { digest, type Actor, type MachineCode, type Order, type QuoteResponse } from '../src/model.js';
import { DEMO_PROJECT, PREVIEW_ADDRESS, PREVIEW_USERS, requireDemoEmulators, seedPreviewAuth, seedPreviewFirestore } from '../scripts/fixtures.js';

let app: App;
let db: Firestore;
let auth: Auth;
let service: CommerceService;
let now: number;
let customerToken: string;
let ownerToken: string;
let noPhoneToken: string;
const customer: Actor = { uid: PREVIEW_USERS.customer.uid, token: { phone_number: PREVIEW_USERS.customer.phoneNumber } };
const other: Actor = { uid: PREVIEW_USERS.other.uid, token: { phone_number: PREVIEW_USERS.other.phoneNumber } };
const owner: Actor = { uid: PREVIEW_USERS.owner.uid, token: { admin: true } };
const request = (channel: 'web' | 'android' = 'web', quantity = 1) => ({ lines: [{ id: '1l', quantity }], address: PREVIEW_ADDRESS, channel });

async function tokenFor(uid: string): Promise<string> {
  const token = await auth.createCustomToken(uid);
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-only-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, returnSecureToken: true }),
  });
  const body = await response.json() as { idToken?: string };
  assert.ok(response.ok && body.idToken, 'Auth emulator must provide an ID token');
  return body.idToken;
}
async function callable<T>(name: string, data: unknown, token?: string): Promise<T> {
  const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001';
  const host = new URL(`http://${functionsHost}`);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(host.hostname), 'Integration calls must stay on loopback');
  const response = await fetch(`http://${functionsHost}/${DEMO_PROJECT}/asia-south1/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = await response.json() as { result?: T; error?: { message?: string; status: string; details?: { code: string } } };
  if (body.error) throw Object.assign(new Error(body.error.message), { machineCode: body.error.details?.code ?? body.error.status });
  assert.ok(response.ok && body.result !== undefined, 'Callable must return its contract response');
  return body.result;
}
async function rejectsCode(operation: () => Promise<unknown>, expected: MachineCode) {
  await assert.rejects(operation, error => {
    const code = error instanceof HttpsError ? (error.details as { code: string }).code : (error as { machineCode?: string }).machineCode;
    return code === expected;
  });
}
async function place(quantity = 1, key = 'stable-order-key-001') {
  const quote = await service.quoteCheckout(customer, request('web', quantity));
  return service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: key });
}
async function assertStock(value: number) {
  assert.equal((await db.doc('_inventory/1l').get()).data()?.availablePacks, value);
  assert.equal((await db.doc('products/groundnut-oil/variants/1l').get()).data()?.stock, value);
}
before(async () => {
  requireDemoEmulators();
  app = initializeApp({ projectId: DEMO_PROJECT }, `commerce-integration-${process.pid}`);
  db = getFirestore(app);
  auth = getAuth(app);
  await seedPreviewAuth(auth);
  try { await auth.createUser({ uid: 'preview-no-phone', displayName: 'No verified phone' }); }
  catch (error) { if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error; }
  [customerToken, ownerToken, noPhoneToken] = await Promise.all([
    tokenFor(customer.uid), tokenFor(owner.uid), tokenFor('preview-no-phone'),
  ]);
});
after(async () => { if (app) await deleteApp(app); });
beforeEach(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${DEMO_PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  assert.ok(response.ok, 'Firestore emulator reset must succeed');
  await seedPreviewFirestore(db);
  now = Date.parse('2026-10-20T10:00:00.000Z');
  service = new CommerceService(db, { isEmulator: true, now: () => now });
});

describe('real callable transport with Auth emulator tokens', () => {
  test('all four endpoints enforce authentication, phone or trusted admin claim', async () => {
    await rejectsCode(() => callable('quoteCheckout', request()), 'AUTH_REQUIRED');
    await rejectsCode(() => callable('quoteCheckout', request(), noPhoneToken), 'PHONE_REQUIRED');
    await rejectsCode(() => callable('placeCodOrder', { quoteId: 'abcdefgh', idempotencyKey: 'abcdefgh' }), 'AUTH_REQUIRED');
    await rejectsCode(() => callable('updateVariant', { id: '1l', pricePaise: 45000, stock: 12, enabled: true }, customerToken), 'ADMIN_REQUIRED');
    await rejectsCode(() => callable('updateOrderStatus', { orderId: 'abcdefgh', status: 'packed' }, customerToken), 'ADMIN_REQUIRED');
    await rejectsCode(() => callable('quoteCheckout', { ...request(), totalPaise: 1 }, customerToken), 'INVALID_INPUT');
  });
  test('quoted totals and duplicate concurrent callable retries create one COD order', async () => {
    const quote = await callable<QuoteResponse>('quoteCheckout', request('android', 2), customerToken);
    assert.equal(quote.subtotalPaise, 90000);
    assert.equal(quote.totalPaise, 90000);
    assert.equal(quote.preview, true);
    assert.equal(quote.codAllowed, true);
    assert.ok(Date.parse(quote.expiresAt) > Date.now());
    const raw = { quoteId: quote.quoteId, idempotencyKey: 'transport-stable-key-001' };
    const results = await Promise.all([callable<{ orderId: string }>('placeCodOrder', raw, customerToken), callable<{ orderId: string }>('placeCodOrder', raw, customerToken)]);
    assert.equal(results[0]!.orderId, results[1]!.orderId);
    assert.equal((await db.collection('orders').get()).size, 1);
    await assertStock(10);
    const order = (await db.doc(`orders/${results[0]!.orderId}`).get()).data() as Order;
    assert.equal(order.uid, customer.uid);
    assert.equal(order.channel, 'android');
    assert.equal(order.customerPhone, PREVIEW_USERS.customer.phoneNumber);
    assert.equal(order.paymentMethod, 'cod');
    assert.equal(order.paymentStatus, 'pending_collection');
    await callable('updateOrderStatus', { orderId: order.id, status: 'packed' }, ownerToken);
    assert.equal((await db.doc(`orders/${order.id}`).get()).data()?.status, 'packed');
  });
  test('the same Firebase identity shares web and Android purchase records', async () => {
    for (const channel of ['web', 'android'] as const) {
      const quote = await callable<QuoteResponse>('quoteCheckout', request(channel), customerToken);
      await callable('placeCodOrder', { quoteId: quote.quoteId, idempotencyKey: `shared-${channel}-retry-key` }, customerToken);
    }
    const orders = await db.collection('orders').where('uid', '==', customer.uid).orderBy('createdAt', 'desc').limit(50).get();
    assert.equal(orders.size, 2);
    assert.deepEqual(new Set(orders.docs.map(doc => doc.data().channel)), new Set(['web', 'android']));
  });
});
describe('quote and retry transactional invariants', () => {
  test('expired and foreign quotes fail, while completed retries survive expiry', async () => {
    const quote = await service.quoteCheckout(customer, request());
    await rejectsCode(() => service.placeCodOrder(other, { quoteId: quote.quoteId, idempotencyKey: 'foreign-retry-key' }), 'QUOTE_OWNER_MISMATCH');
    now += 10 * 60 * 1000;
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'expired-retry-key' }), 'QUOTE_EXPIRED');
    const fresh = await service.quoteCheckout(customer, request());
    const raw = { quoteId: fresh.quoteId, idempotencyKey: 'completed-retry-key' };
    const first = await service.placeCodOrder(customer, raw);
    now += 60 * 60 * 1000;
    assert.deepEqual(await service.placeCodOrder(customer, raw), first);
    assert.deepEqual(await service.placeCodOrder(customer, { ...raw, idempotencyKey: 'another-key-same-quote' }), first);
    assert.equal((await db.collection('orders').get()).size, 1);
    await assertStock(11);
  });
  test('a retry key cannot be rebound, and unknown quotes do not create orders', async () => {
    const first = await service.quoteCheckout(customer, request());
    const second = await service.quoteCheckout(customer, request());
    await service.placeCodOrder(customer, { quoteId: first.quoteId, idempotencyKey: 'never-rebind-this-key' });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: second.quoteId, idempotencyKey: 'never-rebind-this-key' }), 'IDEMPOTENCY_CONFLICT');
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: 'missing-quote-123', idempotencyKey: 'missing-quote-key' }), 'QUOTE_NOT_FOUND');
    assert.equal((await db.collection('orders').get()).size, 1);
  });
  test('changed price or delivery terms invalidate the visible quote', async () => {
    const quote = await service.quoteCheckout(customer, request());
    await service.updateVariant(owner, { id: '1l', pricePaise: 47000, stock: 12, enabled: true });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'changed-price-key' }), 'QUOTE_CHANGED');
    const next = await service.quoteCheckout(customer, request());
    await db.doc('deliveryRules/523201').update({ feePaise: 1000 });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: next.quoteId, idempotencyKey: 'changed-delivery-key' }), 'QUOTE_CHANGED');
    const disabledRuleQuote = await service.quoteCheckout(customer, request());
    await db.doc('deliveryRules/523201').update({ enabled: false });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: disabledRuleQuote.quoteId, idempotencyKey: 'disabled-rule-key' }), 'QUOTE_CHANGED');
    assert.equal((await db.collection('orders').get()).size, 0);
    await assertStock(12);
  });
  test('stock changes alone preserve terms; insufficient, disabled or unpublished packs fail', async () => {
    const quote = await service.quoteCheckout(customer, request());
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 2, enabled: true });
    await service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'stock-change-stable-key' });
    await assertStock(1);
    const remaining = await service.quoteCheckout(customer, request());
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 0, enabled: true });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: remaining.quoteId, idempotencyKey: 'stock-empty-key' }), 'OUT_OF_STOCK');
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 12, enabled: false });
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'OUT_OF_STOCK');
    await db.doc('products/groundnut-oil').update({ published: false });
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'OUT_OF_STOCK');
  });
  test('competing last-pack orders yield exactly one order and zero available packs', async () => {
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 1, enabled: true });
    const quotes = await Promise.all([service.quoteCheckout(customer, request()), service.quoteCheckout(other, request())]);
    const results = await Promise.allSettled([
      service.placeCodOrder(customer, { quoteId: quotes[0]!.quoteId, idempotencyKey: 'last-pack-customer-key' }),
      service.placeCodOrder(other, { quoteId: quotes[1]!.quoteId, idempotencyKey: 'last-pack-other-key' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failed = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal((failed.reason as HttpsError).details && ((failed.reason as HttpsError).details as { code: string }).code, 'OUT_OF_STOCK');
    assert.equal((await db.collection('orders').get()).size, 1);
    await assertStock(0);
  });
  test('single-quote concurrency with different keys still produces a single immutable order', async () => {
    const quote = await service.quoteCheckout(customer, request());
    const results = await Promise.all([
      service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'same-quote-first-key' }),
      service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'same-quote-second-key' }),
    ]);
    assert.deepEqual(results[0], results[1]);
    const original = (await db.doc(`orders/${results[0]!.orderId}`).get()).data();
    await service.updateVariant(owner, { id: '1l', pricePaise: 50000, stock: 11, enabled: true });
    await db.doc(`users/${customer.uid}/addresses/default`).set({ ...PREVIEW_ADDRESS, city: 'A different city' });
    assert.deepEqual((await db.doc(`orders/${results[0]!.orderId}`).get()).data(), original);
    assert.equal((await db.collection('orders').get()).size, 1);
  });
});
describe('owner status, stock and COD transitions', () => {
  test('concurrent cancellation restores exactly once and preserves purchase facts', async () => {
    const { orderId } = await place(2);
    const original = (await db.doc(`orders/${orderId}`).get()).data() as Order;
    await assertStock(10);
    await Promise.all([
      service.updateOrderStatus(owner, { orderId, status: 'cancelled' }),
      service.updateOrderStatus(owner, { orderId, status: 'cancelled' }),
    ]);
    await assertStock(12);
    const cancelled = (await db.doc(`orders/${orderId}`).get()).data() as Order;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.paymentStatus, 'cancelled');
    assert.deepEqual(cancelled.lines, original.lines);
    assert.equal(cancelled.totalPaise, original.totalPaise);
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'received' }), 'INVALID_TRANSITION');
  });
  test('packed cancellation remains valid even after disabling the variant', async () => {
    const { orderId } = await place();
    await service.updateOrderStatus(owner, { orderId, status: 'packed' });
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 11, enabled: false });
    await service.updateOrderStatus(owner, { orderId, status: 'cancelled' });
    await assertStock(12);
    assert.equal((await db.doc('products/groundnut-oil/variants/1l').get()).data()?.enabled, false);
  });
  test('fulfillment is sequential, COD is collected on delivery, and dispatch cannot be cancelled', async () => {
    const { orderId } = await place();
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'delivered' }), 'INVALID_TRANSITION');
    for (const status of ['packed', 'shipped', 'delivered'] as const) {
      await service.updateOrderStatus(owner, { orderId, status });
      if (status === 'shipped') await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'cancelled' }), 'INVALID_TRANSITION');
    }
    await service.updateOrderStatus(owner, { orderId, status: 'delivered' });
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'cancelled' }), 'INVALID_TRANSITION');
    assert.equal((await db.doc(`orders/${orderId}`).get()).data()?.paymentStatus, 'collected');
    await assertStock(11);
  });
  test('admin mutations reject untrusted claims and invalid inputs, and stock updates maintain projection', async () => {
    await rejectsCode(() => service.updateVariant(customer, { id: '1l', pricePaise: 45000, stock: 12, enabled: true }), 'ADMIN_REQUIRED');
    await rejectsCode(() => service.updateVariant(owner, { id: '1l', pricePaise: 1, stock: 12, enabled: true }), 'INVALID_INPUT');
    await service.updateVariant(owner, { id: '1l', pricePaise: 49000, stock: 3, enabled: true });
    await assertStock(3);
    assert.equal((await db.doc('products/groundnut-oil/variants/1l').get()).data()?.pricePaise, 49000);
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId: 'missing-order-123', status: 'packed' }), 'ORDER_NOT_FOUND');
  });
});
describe('configuration, preview and request abuse controls', () => {
  test('disabled/missing setup, missing exact PIN and unavailable COD cannot accept an order', async () => {
    await db.doc('publicContent/storefront').update({ orderingEnabled: false });
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    await db.doc('publicContent/storefront').update({ orderingEnabled: true });
    await rejectsCode(() => service.quoteCheckout(customer, { ...request(), address: { ...PREVIEW_ADDRESS, pin: '999999' } }), 'NOT_SERVICEABLE');
    await db.doc('deliveryRules/523201').update({ codAllowed: false });
    const quote = await service.quoteCheckout(customer, request());
    assert.equal(quote.codAllowed, false);
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'no-cod-retry-key' }), 'COD_UNAVAILABLE');
    assert.equal((await db.collection('orders').get()).size, 0);
  });
  test('omitted surcharge fields default to zero and courier pricing uses pack litres', async () => {
    await db.doc('deliveryRules/523201').update({ extraLitrePaise: FieldValue.delete(), includedLitres: FieldValue.delete(), feePaise: 2000 });
    assert.equal((await service.quoteCheckout(customer, request())).shippingPaise, 2000);
    const quote = await service.quoteCheckout(customer, { lines: [{ id: '5l', quantity: 1 }], address: { ...PREVIEW_ADDRESS, pin: '500001' }, channel: 'web' });
    assert.equal(quote.shippingPaise, 19500);
    assert.equal(quote.totalPaise, 244500);
  });
  test('every preview source blocks checkout outside the emulator, independently of storefront marker', async () => {
    const productionService = new CommerceService(db, { isEmulator: false, now: () => now });
    const paths = ['publicContent/storefront', 'products/groundnut-oil', 'deliveryRules/523201',
      'products/groundnut-oil/variants/1l', '_inventory/1l'];
    for (const markerPath of paths) {
      const batch = db.batch();
      for (const path of paths) batch.update(db.doc(path), { preview: path === markerPath });
      await batch.commit();
      await rejectsCode(() => productionService.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    }
    assert.equal((await db.collection('orders').get()).size, 0);
  });
  test('a drifted stock projection or missing private stock blocks checkout', async () => {
    await db.doc('products/groundnut-oil/variants/1l').update({ stock: 100 });
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    await db.doc('products/groundnut-oil/variants/1l').update({ stock: 12 });
    await db.doc('_inventory/1l').delete();
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_NOT_READY');
  });
  test('quote bursts are rate limited, and stable completed order retries bypass an exhausted limit', async () => {
    const first = await place();
    for (let i = 0; i < 9; i++) await service.quoteCheckout(customer, request());
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'RATE_LIMITED');
    const key = 'stable-order-key-001';
    const quoteId = (await db.doc(`_orderRequests/${digest([customer.uid, key])}`).get()).data()?.quoteId;
    await db.doc(`_checkoutLimits/${digest([customer.uid, 'order'])}`).set({ count: 20, startedAtMs: now });
    assert.deepEqual(await service.placeCodOrder(customer, { quoteId, idempotencyKey: key }), first);
    await assertStock(11);
  });
});
