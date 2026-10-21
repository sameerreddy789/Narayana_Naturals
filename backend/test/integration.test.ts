import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { AppCheck } from 'firebase-admin/app-check';
import { getDatabase, type Database } from 'firebase-admin/database';
import { CommerceService } from '../src/commerce.js';
import { DEMO_DATABASE_URL } from '../src/config.js';
import { createCommerceServer } from '../src/http.js';
import { ApiError, digest, type Actor, type MachineCode, type Order, type QuoteResponse } from '../src/model.js';
import { DEMO_PROJECT, PREVIEW_ADDRESS, PREVIEW_PASSWORD, PREVIEW_USERS,
  previewCommerce, requireDemoEmulators, seedPreviewAuth, seedPreviewDatabase } from '../scripts/fixtures.js';
import { initializePrivateDraft, privateDraftCommerce } from '../scripts/private-draft.js';

let app: App;
let peerApp: App;
let db: Database;
let peerDb: Database;
let auth: Auth;
let service: CommerceService;
let peerService: CommerceService;
let server: Server;
let baseUrl: string;
let now: number;
let customerToken: string;
let otherToken: string;
let ownerToken: string;
let testerToken: string;
let anonymousToken: string;
let customer: Actor;
let other: Actor;
let owner: Actor;
let tester: Actor;
const CLOCK_START = Date.parse('2026-10-20T10:00:00.000Z');
const request = (channel: 'web' | 'android' = 'web', quantity = 1) => ({
  lines: [{ id: '1l', quantity }], address: { ...PREVIEW_ADDRESS }, channel,
});

function requireIsolatedTestEmulators() {
  requireDemoEmulators();
  assert.equal(new URL(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`).port, '9100', 'Database resets require the isolated test emulator on port 9100');
  assert.equal(new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`).port, '9199', 'Auth fixtures require the isolated test emulator on port 9199');
}
async function authRequest(endpoint: string, data: unknown): Promise<string> {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=emulator-only-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const body = await response.json() as { idToken?: string; error?: unknown };
  assert.ok(response.ok && body.idToken, `Auth emulator ${endpoint} must return an ID token: ${JSON.stringify(body.error)}`);
  return body.idToken;
}
const signIn = (email: string) => authRequest('signInWithPassword', { email, password: PREVIEW_PASSWORD, returnSecureToken: true });
async function actorFor(token: string): Promise<Actor> {
  const decoded = await auth.verifyIdToken(token, true);
  return { uid: decoded.uid, token: decoded as unknown as Record<string, unknown> };
}
type Method = 'quoteCheckout' | 'placeCodOrder' | 'updateVariant' | 'updateOrderStatus';
async function api<T>(method: Method, data: unknown, token?: string, appCheckToken?: string): Promise<T> {
  const response = await fetch(`${baseUrl}/v1/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = await response.json() as { data?: T; error?: { code: string; message: string } };
  if (body.error) throw Object.assign(new Error(body.error.message), { machineCode: body.error.code, status: response.status });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(body.data !== undefined, 'The API must return the data contract');
  return body.data;
}
async function rejectsCode(operation: () => Promise<unknown>, code: MachineCode, status?: number) {
  await assert.rejects(operation, error => {
    const actual = error instanceof ApiError ? error.code : (error as { machineCode?: string }).machineCode;
    assert.equal(actual, code);
    if (status !== undefined) assert.equal((error as { status?: number }).status, status);
    return true;
  });
}
async function value(path: string) { return (await db.ref(path).get()).val(); }
async function stock(expected: number, id = '1l') { assert.equal(await value(`commerce/variants/${id}/stock`), expected); }
async function orderCopies(orderId: string, uid = customer.uid): Promise<Order> {
  const index = await value(`commerce/orderIndex/${orderId}`) as Order;
  const customerCopy = await value(`commerce/ordersByUser/${uid}/${orderId}`) as Order;
  assert.ok(index && customerCopy, 'Both order projections must exist');
  assert.deepEqual(customerCopy, index);
  return index;
}
async function place(quantity = 1, idempotencyKey = 'stable-order-key-001') {
  const quote = await service.quoteCheckout(customer, request('web', quantity));
  return service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey });
}
async function orderCount(expected: number) {
  assert.equal(Object.keys((await value('commerce/orderIndex')) ?? {}).length, expected);
}
function productionCommerce() {
  const data = previewCommerce();
  data.publicContent.storefront.preview = false;
  data.products['groundnut-oil'].preview = false;
  for (const variant of Object.values(data.variants)) variant.preview = false;
  return { ...data, deliveryRules: Object.fromEntries(Object.entries(data.deliveryRules).map(([pin, rule]) => [pin, { ...rule, preview: false }])) };
}
// Order-flow fixtures are confined to the isolated test emulator. The live
// initializer is deliberately disabled and is tested separately below.
async function enablePrivateOrderingFixture() {
  requireIsolatedTestEmulators();
  const preview = previewCommerce();
  await db.ref('commerceDraft').update({
    'publicContent/storefront/orderingEnabled': true,
    variants: preview.variants,
    deliveryRules: Object.fromEntries(Object.entries(preview.deliveryRules).map(([pin, rule]) => [pin,
      { ...rule, estimate: 'Private test: no fulfilment' }])),
  });
}
async function initializeOrderablePrivateFixture() {
  await initializePrivateDraft(db);
  await enablePrivateOrderingFixture();
}
async function startServer(nextService: CommerceService, isEmulator = true, appCheck?: AppCheck) {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  server = createCommerceServer({ service: nextService, auth, appCheck, isEmulator, origins: ['http://localhost:3000'], projectId: DEMO_PROJECT,
    health: async () => {
      const snapshot = await db.ref(`${nextService.commerceRoot}/publicContent/storefront`).get();
      return { configured: snapshot.exists(), orderingEnabled: snapshot.child('orderingEnabled').val() === true,
        onlinePaymentsEnabled: snapshot.child('onlinePaymentsEnabled').val() === true };
    } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

before(async () => {
  requireIsolatedTestEmulators();
  app = initializeApp({ projectId: DEMO_PROJECT, databaseURL: DEMO_DATABASE_URL }, `rtdb-integration-${process.pid}`);
  peerApp = initializeApp({ projectId: DEMO_PROJECT, databaseURL: DEMO_DATABASE_URL }, `rtdb-peer-${process.pid}`);
  db = getDatabase(app);
  peerDb = getDatabase(peerApp);
  auth = getAuth(app);
  await seedPreviewAuth(auth);
  [customerToken, otherToken, ownerToken] = await Promise.all([
    signIn(PREVIEW_USERS.customer.email), signIn(PREVIEW_USERS.other.email), signIn(PREVIEW_USERS.owner.email),
  ]);
  anonymousToken = await authRequest('signUp', { returnSecureToken: true });
  [customer, other, owner] = await Promise.all([actorFor(customerToken), actorFor(otherToken), actorFor(ownerToken)]);
  assert.equal(customer.token.email, PREVIEW_USERS.customer.email);
  assert.equal((customer.token.firebase as { sign_in_provider: string }).sign_in_provider, 'password');
  assert.equal(owner.token.admin, true);
  await auth.setCustomUserClaims(customer.uid, { tester: true });
  testerToken = await signIn(PREVIEW_USERS.customer.email);
  tester = await actorFor(testerToken);
  assert.equal(tester.token.tester, true);
});
after(async () => {
  if (peerApp) await deleteApp(peerApp);
  if (app) await deleteApp(app);
});
beforeEach(async () => {
  await db.ref().set(null);
  await seedPreviewDatabase(db);
  now = CLOCK_START;
  service = new CommerceService(db, { isEmulator: true, now: () => now });
  peerService = new CommerceService(peerDb, { isEmulator: true, now: () => now });
  await startServer(service);
});
afterEach(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

describe('HTTP API with real email-password Auth emulator tokens', () => {
  test('all endpoints require authentication and owner actions require the trusted admin claim', async () => {
    for (const [method, data] of [
      ['quoteCheckout', request()], ['placeCodOrder', { quoteId: 'missing-quote-123', idempotencyKey: 'missing-key-123' }],
      ['updateVariant', { id: '1l', pricePaise: 45000, stock: 12, enabled: true }],
      ['updateOrderStatus', { orderId: 'missing-order-123', status: 'packed' }],
    ] as const) await rejectsCode(() => api(method, data), 'AUTH_REQUIRED', 401);
    await rejectsCode(() => api('quoteCheckout', request(), 'this-is-an-invalid-id-token'), 'AUTH_REQUIRED', 401);
    await rejectsCode(() => api('quoteCheckout', request(), anonymousToken), 'EMAIL_REQUIRED', 409);
    await rejectsCode(() => api('placeCodOrder', { quoteId: 'missing-quote-123', idempotencyKey: 'missing-key-123' }, anonymousToken), 'EMAIL_REQUIRED', 409);
    await rejectsCode(() => api('updateVariant', { id: '1l', pricePaise: 45000, stock: 12, enabled: true }, customerToken), 'ADMIN_REQUIRED', 403);
    await rejectsCode(() => api('updateOrderStatus', { orderId: 'missing-order-123', status: 'packed' }, customerToken), 'ADMIN_REQUIRED', 403);
    await rejectsCode(() => api('quoteCheckout', { ...request(), totalPaise: 1 }, customerToken), 'INVALID_INPUT', 400);
    await rejectsCode(() => api('quoteCheckout', { ...request(), lines: [{ id: '1l', quantity: 1, unitPricePaise: 1 }] }, customerToken), 'INVALID_INPUT', 400);
    await stock(12);
    await orderCount(0);
  });
  test('server prices and litre-based courier fees produce one COD order for concurrent HTTP retries', async () => {
    const quote = await api<QuoteResponse>('quoteCheckout', { channel: 'android', address: { ...PREVIEW_ADDRESS, pin: '500001' },
      lines: [{ id: '5l', quantity: 1 }, { id: '1l', quantity: 2 }] }, customerToken);
    assert.equal(quote.subtotalPaise, 315000);
    assert.equal(quote.shippingPaise, 24500);
    assert.equal(quote.totalPaise, 339500);
    assert.equal(quote.expiresAt, now + 10 * 60 * 1000);
    assert.equal(quote.preview, true);
    assert.equal(quote.codAllowed, true);
    const raw = { quoteId: quote.quoteId, idempotencyKey: 'transport-stable-key-001' };
    const results = await Promise.all([api<{ orderId: string }>('placeCodOrder', raw, customerToken), api<{ orderId: string }>('placeCodOrder', raw, customerToken)]);
    assert.deepEqual(results[0], results[1]);
    await orderCount(1);
    await stock(10);
    await stock(3, '5l');
    const order = await orderCopies(results[0]!.orderId);
    assert.equal(order.uid, customer.uid);
    assert.equal(order.channel, 'android');
    assert.equal(order.customerPhone, `+91${PREVIEW_ADDRESS.phone}`);
    assert.equal(order.paymentMethod, 'cod');
    assert.equal(order.paymentStatus, 'pending_collection');
    assert.equal(order.createdAt, now);
    assert.ok(Number.isSafeInteger(order.createdAt) && order.createdAt > 1_000_000_000_000, 'Order timestamps are epoch milliseconds');
    assert.deepEqual(order.lines, quote.lines);
    assert.equal(order.totalPaise, quote.totalPaise);
    assert.deepEqual(order.address, { ...PREVIEW_ADDRESS, pin: '500001' });
    now += 1000;
    await api('updateOrderStatus', { orderId: order.id, status: 'packed' }, ownerToken);
    assert.equal((await orderCopies(order.id)).updatedAt, now);
  });
  test('the same Firebase identity shares web and Android order history', async () => {
    for (const channel of ['web', 'android'] as const) {
      const quote = await api<QuoteResponse>('quoteCheckout', request(channel), customerToken);
      await api('placeCodOrder', { quoteId: quote.quoteId, idempotencyKey: `shared-${channel}-retry-key` }, customerToken);
    }
    const history = (await db.ref(`commerce/ordersByUser/${customer.uid}`).orderByChild('createdAt').limitToLast(50).get()).val() as Record<string, Order>;
    assert.equal(Object.keys(history).length, 2);
    assert.deepEqual(new Set(Object.values(history).map(order => order.channel)), new Set(['web', 'android']));
    for (const order of Object.values(history)) await orderCopies(order.id);
    const quote = await api<QuoteResponse>('quoteCheckout', request(), customerToken);
    await rejectsCode(() => api('placeCodOrder', { quoteId: quote.quoteId, idempotencyKey: 'foreign-http-retry-key' }, otherToken), 'QUOTE_OWNER_MISMATCH', 403);
  });
  test('health, allowed-origin preflight and denied origins retain the HTTP contract', async () => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', mode: 'emulator', stage: 'production', projectId: DEMO_PROJECT,
      database: 'realtime', authentication: 'email_password', checkout: 'cod', onlinePaymentsEnabled: false });
    const preflight = await fetch(`${baseUrl}/v1/quoteCheckout`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    const denied = await fetch(`${baseUrl}/v1/quoteCheckout`, { method: 'POST', headers: { Origin: 'https://untrusted.example',
      'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` }, body: JSON.stringify({ data: request() }) });
    assert.equal(denied.status, 403);
    assert.equal(((await denied.json()) as { error: { code: string } }).error.code, 'ORIGIN_NOT_ALLOWED');
  });
});

describe('transactional quotes, stock and durable retry receipts', () => {
  test('expired, missing and foreign quotes cannot create an order', async () => {
    const quote = await service.quoteCheckout(customer, request());
    await rejectsCode(() => peerService.placeCodOrder(other, { quoteId: quote.quoteId, idempotencyKey: 'foreign-retry-key' }), 'QUOTE_OWNER_MISMATCH');
    now = quote.expiresAt;
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'expired-retry-key' }), 'QUOTE_EXPIRED');
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: 'missing-quote-123', idempotencyKey: 'missing-quote-key' }), 'QUOTE_NOT_FOUND');
    await stock(12);
    await orderCount(0);
  });
  test('price, delivery fee and disabled-PIN changes invalidate a quote without reducing stock', async () => {
    const first = await service.quoteCheckout(customer, request());
    await api('updateVariant', { id: '1l', pricePaise: 47000, stock: 12, enabled: true }, ownerToken);
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: first.quoteId, idempotencyKey: 'changed-price-key' }), 'QUOTE_CHANGED');
    const next = await service.quoteCheckout(customer, request());
    await db.ref(`commerce/deliveryRules/${PREVIEW_ADDRESS.pin}`).update({ feePaise: 1000 });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: next.quoteId, idempotencyKey: 'changed-fee-key' }), 'QUOTE_CHANGED');
    const disabled = await service.quoteCheckout(customer, request());
    await db.ref(`commerce/deliveryRules/${PREVIEW_ADDRESS.pin}`).update({ enabled: false });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: disabled.quoteId, idempotencyKey: 'disabled-pin-key' }), 'QUOTE_CHANGED');
    await stock(12);
    await orderCount(0);
  });
  test('stock changes preserve prices, but insufficient, disabled or unpublished packs cannot be sold', async () => {
    const quote = await service.quoteCheckout(customer, request());
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 2, enabled: true });
    await service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'stock-change-key' });
    await stock(1);
    const remaining = await service.quoteCheckout(customer, request());
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 0, enabled: true });
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: remaining.quoteId, idempotencyKey: 'empty-stock-key' }), 'OUT_OF_STOCK');
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 12, enabled: false });
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'OUT_OF_STOCK');
    await db.ref('commerce/products/groundnut-oil/published').set(false);
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'OUT_OF_STOCK');
    await orderCount(1);
  });
  test('independent database clients competing for the last pack commit exactly one order', async () => {
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 1, enabled: true });
    const first = await service.quoteCheckout(customer, request());
    const second = await peerService.quoteCheckout(other, request());
    const results = await Promise.allSettled([
      service.placeCodOrder(customer, { quoteId: first.quoteId, idempotencyKey: 'last-pack-customer-key' }),
      peerService.placeCodOrder(other, { quoteId: second.quoteId, idempotencyKey: 'last-pack-other-key' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.ok(failure.reason instanceof ApiError);
    assert.equal(failure.reason.code, 'OUT_OF_STOCK');
    await stock(0);
    await orderCount(1);
    const entries = (await value('commerce/orderIndex')) as Record<string, Order>;
    for (const order of Object.values(entries)) await orderCopies(order.id, order.uid);
    assert.equal(Object.keys((await value('commerce/idempotency')) ?? {}).length, 1);
  });
  test('different keys for one quote and retries after a backend restart return the original immutable order', async () => {
    const quote = await service.quoteCheckout(customer, request());
    const firstRequest = { quoteId: quote.quoteId, idempotencyKey: 'same-quote-first-key' };
    const secondRequest = { quoteId: quote.quoteId, idempotencyKey: 'same-quote-second-key' };
    const [first, second] = await Promise.all([service.placeCodOrder(customer, firstRequest), peerService.placeCodOrder(customer, secondRequest)]);
    assert.deepEqual(first, second);
    const original = await orderCopies(first.orderId);
    now += 7 * 24 * 60 * 60 * 1000;
    await service.updateVariant(owner, { id: '1l', pricePaise: 50000, stock: 11, enabled: true });
    await db.ref(`users/${customer.uid}/addresses/default`).set({ ...PREVIEW_ADDRESS, city: 'A different city' });
    await db.ref(`commerce/limits/${digest([customer.uid, 'order'])}`).set({ startedAt: now, count: 20 });
    const restartedApp = initializeApp({ projectId: DEMO_PROJECT, databaseURL: DEMO_DATABASE_URL }, `rtdb-restarted-${process.pid}`);
    try {
      const restarted = new CommerceService(getDatabase(restartedApp), { isEmulator: true, now: () => now });
      assert.deepEqual(await restarted.placeCodOrder(customer, firstRequest), first);
      assert.deepEqual(await restarted.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'after-restart-third-key' }), first);
    } finally { await deleteApp(restartedApp); }
    assert.deepEqual(await orderCopies(first.orderId), original);
    await stock(11);
    await orderCount(1);
    const receipts = await value('commerce/idempotency') as Record<string, { orderId: string; quoteId: string }>;
    assert.equal(Object.keys(receipts).length, 3);
    for (const receipt of Object.values(receipts)) assert.deepEqual({ orderId: receipt.orderId, quoteId: receipt.quoteId }, { ...first, quoteId: quote.quoteId });
  });
  test('an idempotency key cannot be rebound to another quote', async () => {
    const first = await service.quoteCheckout(customer, request());
    const second = await service.quoteCheckout(customer, request());
    await service.placeCodOrder(customer, { quoteId: first.quoteId, idempotencyKey: 'never-rebind-this-key' });
    await rejectsCode(() => peerService.placeCodOrder(customer, { quoteId: second.quoteId, idempotencyKey: 'never-rebind-this-key' }), 'IDEMPOTENCY_CONFLICT');
    await stock(11);
    await orderCount(1);
  });
});

describe('owner fulfillment and once-only cancellation', () => {
  test('concurrent cancellation restores stock once and updates both copies without changing purchase facts', async () => {
    const { orderId } = await place(2);
    const original = await orderCopies(orderId);
    await stock(10);
    now += 1000;
    await Promise.all([service.updateOrderStatus(owner, { orderId, status: 'cancelled' }), peerService.updateOrderStatus(owner, { orderId, status: 'cancelled' })]);
    await stock(12);
    const cancelled = await orderCopies(orderId);
    assert.deepEqual(cancelled, { ...original, status: 'cancelled', paymentStatus: 'cancelled', updatedAt: now });
    now += 1000;
    await service.updateOrderStatus(owner, { orderId, status: 'cancelled' });
    assert.deepEqual(await orderCopies(orderId), cancelled);
    await stock(12);
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'received' }), 'INVALID_TRANSITION');
  });
  test('packed cancellation restores disabled packs without making them available for sale', async () => {
    const { orderId } = await place();
    await service.updateOrderStatus(owner, { orderId, status: 'packed' });
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 11, enabled: false });
    await service.updateOrderStatus(owner, { orderId, status: 'cancelled' });
    await stock(12);
    assert.equal(await value('commerce/variants/1l/enabled'), false);
    assert.equal((await orderCopies(orderId)).paymentStatus, 'cancelled');
  });
  test('fulfillment is sequential, delivery collects COD, and shipped orders cannot be cancelled', async () => {
    const { orderId } = await place();
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'delivered' }), 'INVALID_TRANSITION');
    for (const status of ['packed', 'shipped', 'delivered'] as const) {
      now += 1000;
      await api('updateOrderStatus', { orderId, status }, ownerToken);
      const order = await orderCopies(orderId);
      assert.equal(order.status, status);
      assert.equal(order.updatedAt, now);
      assert.equal(order.paymentStatus, status === 'delivered' ? 'collected' : 'pending_collection');
      if (status === 'shipped') await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'cancelled' }), 'INVALID_TRANSITION');
    }
    await service.updateOrderStatus(owner, { orderId, status: 'delivered' });
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId, status: 'cancelled' }), 'INVALID_TRANSITION');
    await rejectsCode(() => service.updateOrderStatus(owner, { orderId: 'missing-order-123', status: 'packed' }), 'ORDER_NOT_FOUND');
    await stock(11);
  });
});

describe('PIN, preview and request controls', () => {
  test('missing exact PIN, disabled setup and unavailable COD cannot accept orders', async () => {
    await rejectsCode(() => api('quoteCheckout', { ...request(), address: { ...PREVIEW_ADDRESS, pin: '999999' } }, customerToken), 'NOT_SERVICEABLE', 409);
    await db.ref('commerce/publicContent/storefront/orderingEnabled').set(false);
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    await db.ref('commerce/publicContent/storefront/orderingEnabled').set(true);
    await db.ref(`commerce/deliveryRules/${PREVIEW_ADDRESS.pin}/codAllowed`).set(false);
    const quote = await service.quoteCheckout(customer, request());
    assert.equal(quote.codAllowed, false);
    await rejectsCode(() => service.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'no-cod-retry-key' }), 'COD_UNAVAILABLE');
    await stock(12);
    await orderCount(0);
  });
  test('omitted surcharge fields default to zero and malformed store prices block checkout', async () => {
    await db.ref(`commerce/deliveryRules/${PREVIEW_ADDRESS.pin}`).update({ extraLitrePaise: null, includedLitres: null, feePaise: 2000 });
    assert.equal((await service.quoteCheckout(customer, request())).shippingPaise, 2000);
    await db.ref('commerce/variants/1l/pricePaise').set(45000.5);
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    await orderCount(0);
  });
  test('each preview source independently blocks live-mode quoting while all writes remain in the emulator', async () => {
    const livePolicy = new CommerceService(db, { isEmulator: false, now: () => now });
    const paths = ['commerce/publicContent/storefront/preview', 'commerce/products/groundnut-oil/preview',
      `commerce/deliveryRules/${PREVIEW_ADDRESS.pin}/preview`, 'commerce/variants/1l/preview'];
    for (const marker of paths) {
      await db.ref().update(Object.fromEntries(paths.map(path => [path, path === marker])));
      await rejectsCode(() => livePolicy.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    }
    await db.ref().update(Object.fromEntries(paths.map(path => [path, false])));
    assert.equal((await livePolicy.quoteCheckout(customer, request())).preview, false);
    await stock(12);
    await orderCount(0);
  });
  test('quote bursts are limited, the window resets, and completed retries bypass an exhausted order limit', async () => {
    const quote = await service.quoteCheckout(customer, request());
    const raw = { quoteId: quote.quoteId, idempotencyKey: 'rate-stable-order-key' };
    const first = await service.placeCodOrder(customer, raw);
    for (let i = 0; i < 9; i++) await service.quoteCheckout(customer, request());
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'RATE_LIMITED');
    await db.ref(`commerce/limits/${digest([customer.uid, 'order'])}`).set({ count: 20, startedAt: now });
    assert.deepEqual(await peerService.placeCodOrder(customer, raw), first);
    now += 60 * 1000;
    await service.quoteCheckout(customer, request());
    await stock(11);
  });
});

describe('bounded ledger capacity and receipt retention', () => {
  test('the order limit rolls back competing new orders while preserving completed retries', async () => {
    const bounded = new CommerceService(db, { isEmulator: true, now: () => now, maxOrders: 1 });
    const firstQuote = await bounded.quoteCheckout(customer, request());
    const secondQuote = await bounded.quoteCheckout(other, request());
    const raw = { quoteId: firstQuote.quoteId, idempotencyKey: 'capacity-first-key' };
    const first = await bounded.placeCodOrder(customer, raw);
    const ledger = await value('commerce');
    await rejectsCode(() => bounded.placeCodOrder(other, { quoteId: secondQuote.quoteId, idempotencyKey: 'capacity-second-key' }), 'STORE_CAPACITY');
    await rejectsCode(() => bounded.quoteCheckout(customer, request()), 'STORE_CAPACITY');
    assert.deepEqual(await value('commerce'), ledger, 'Capacity failure must leave stock, orders, receipts and limits unchanged');
    assert.deepEqual(await bounded.placeCodOrder(customer, raw), first);
    await stock(11);
    await orderCount(1);
  });
  test('the receipt limit preserves old retry keys and rolls back new orders or extra retry keys', async () => {
    const bounded = new CommerceService(db, { isEmulator: true, now: () => now, maxReceipts: 1 });
    const firstQuote = await bounded.quoteCheckout(customer, request());
    const nextQuote = await bounded.quoteCheckout(other, request());
    const raw = { quoteId: firstQuote.quoteId, idempotencyKey: 'receipt-first-key' };
    const first = await bounded.placeCodOrder(customer, raw);
    const ledger = await value('commerce');
    await rejectsCode(() => bounded.placeCodOrder(other, { quoteId: nextQuote.quoteId, idempotencyKey: 'receipt-second-key' }), 'STORE_CAPACITY');
    await rejectsCode(() => bounded.placeCodOrder(customer, { quoteId: firstQuote.quoteId, idempotencyKey: 'receipt-extra-key' }), 'STORE_CAPACITY');
    assert.deepEqual(await value('commerce'), ledger);
    assert.deepEqual(await bounded.placeCodOrder(customer, raw), first);
  });
  test('byte, active quote and active limit bounds reject mutations atomically', async () => {
    const baseline = await value('commerce');
    const tooSmall = new CommerceService(db, { isEmulator: true, now: () => now, maxBytes: 1 });
    await rejectsCode(() => tooSmall.quoteCheckout(customer, request()), 'STORE_CAPACITY');
    assert.deepEqual(await value('commerce'), baseline);
    const quote = await service.quoteCheckout(customer, request());
    const stored = await value(`commerce/quotes/${quote.quoteId}`);
    await db.ref('commerce/quotes').set(Object.fromEntries(Array.from({ length: 750 }, (_, i) => [`active-quote-${i}`, { ...stored, quoteId: `active-quote-${i}` }])));
    const quoteBound = await value('commerce');
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_CAPACITY');
    assert.deepEqual(await value('commerce'), quoteBound);
    await db.ref('commerce/quotes').remove();
    await db.ref('commerce/limits').set(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`active-limit-${i}`, { startedAt: now, count: 1 }])));
    const limitBound = await value('commerce');
    await rejectsCode(() => service.quoteCheckout(customer, request()), 'STORE_CAPACITY');
    assert.deepEqual(await value('commerce'), limitBound);
  });
  test('pruning removes expired unconsumed quotes and old limits while permanently retaining completed receipts', async () => {
    const consumed = await service.quoteCheckout(customer, request());
    const raw = { quoteId: consumed.quoteId, idempotencyKey: 'retained-receipt-key' };
    const first = await service.placeCodOrder(customer, raw);
    const unused = await service.quoteCheckout(customer, request());
    const receipts = await value('commerce/idempotency');
    now += 30 * 24 * 60 * 60 * 1000;
    await service.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 11, enabled: true });
    assert.equal(await value(`commerce/quotes/${unused.quoteId}`), null);
    assert.equal(await value(`commerce/quotes/${consumed.quoteId}/consumedOrderId`), first.orderId);
    assert.deepEqual(await value('commerce/idempotency'), receipts);
    assert.equal(await value(`commerce/limits/${digest([customer.uid, 'quote'])}`), null);
    assert.deepEqual(await peerService.placeCodOrder(customer, raw), first);
    assert.deepEqual(await peerService.placeCodOrder(customer, { quoteId: consumed.quoteId, idempotencyKey: 'retained-new-retry-key' }), first);
    await stock(11);
    await orderCount(1);
  });
});

describe('private draft stage isolation and live verification policy', () => {
  test('the client demonstration rejects checkout even for approved testers and preserves both ledgers', async () => {
    await initializePrivateDraft(db);
    const production = await value('commerce');
    const baseline = await value('commerceDraft');
    const draft = new CommerceService(db, { isEmulator: false, stage: 'private-draft', now: () => now });
    await rejectsCode(() => draft.quoteCheckout(tester, { ...request(), address: { ...PREVIEW_ADDRESS, pin: '517502' } }), 'STORE_NOT_READY');
    await rejectsCode(() => draft.quoteCheckout(owner, request()), 'STORE_NOT_READY');
    assert.deepEqual(await value('commerceDraft'), baseline);
    assert.deepEqual(await value('commerce'), production);
    assert.equal(await value('commerceDraft/orderIndex'), null);
    assert.equal(await value('commerceDraft/quotes'), null);
  });
  test('private samples allow only approved testers and all commerce writes stay in commerceDraft', async () => {
    const production = await value('commerce');
    assert.equal(await initializePrivateDraft(db), true);
    await enablePrivateOrderingFixture();
    const draft = new CommerceService(db, { isEmulator: false, stage: 'private-draft', now: () => now });
    assert.equal(draft.commerceRoot, 'commerceDraft');
    assert.equal(service.stage, 'production');
    assert.equal(service.commerceRoot, 'commerce');
    await rejectsCode(() => draft.quoteCheckout(customer, request()), 'TESTER_REQUIRED', 403);
    await rejectsCode(() => draft.quoteCheckout({ ...customer, token: { ...customer.token, tester: 'true' } }, request()), 'TESTER_REQUIRED', 403);
    const quote = await draft.quoteCheckout(tester, request('android', 2));
    assert.equal(quote.preview, true);
    assert.equal(quote.estimate, 'Private test: no fulfilment');
    await rejectsCode(() => draft.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'unapproved-draft-key' }), 'TESTER_REQUIRED', 403);
    await rejectsCode(() => draft.updateVariant(tester, { id: '1l', pricePaise: 45000, stock: 12, enabled: true }), 'ADMIN_REQUIRED', 403);
    const { orderId } = await draft.placeCodOrder(tester, { quoteId: quote.quoteId, idempotencyKey: 'private-draft-order-key' });
    const original = await value(`commerceDraft/orderIndex/${orderId}`) as Order;
    assert.equal(original.preview, true);
    assert.equal(original.uid, tester.uid);
    assert.equal(original.createdAt, now);
    assert.deepEqual(await value(`commerceDraft/ordersByUser/${tester.uid}/${orderId}`), original);
    assert.equal(await value('commerceDraft/variants/1l/stock'), 10);
    await draft.updateVariant(owner, { id: '1l', pricePaise: 47000, stock: 10, enabled: true });
    now += 1000;
    await draft.updateOrderStatus(owner, { orderId, status: 'packed' });
    await draft.updateOrderStatus(owner, { orderId, status: 'cancelled' });
    assert.equal(await value('commerceDraft/variants/1l/stock'), 12);
    const cancelled = await value(`commerceDraft/orderIndex/${orderId}`) as Order;
    assert.equal(cancelled.preview, true);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.paymentStatus, 'cancelled');
    assert.deepEqual(await value(`commerceDraft/ordersByUser/${tester.uid}/${orderId}`), cancelled);
    assert.deepEqual(await value('commerce'), production);
  });
  test('every live private mutation still requires verified Auth and App Check before tester or owner access', async () => {
    await initializeOrderablePrivateFixture();
    const draft = new CommerceService(db, { isEmulator: false, stage: 'private-draft', now: () => now });
    const appCheck = { verifyToken: async (token: string) => {
      if (token !== 'verified-test-appcheck') throw new Error('Invalid test App Check token');
      return {};
    } } as unknown as AppCheck;
    await startServer(draft, false, appCheck);
    const endpoints = [
      ['quoteCheckout', request(), testerToken],
      ['placeCodOrder', { quoteId: 'missing-quote-123', idempotencyKey: 'missing-retry-key' }, testerToken],
      ['updateVariant', { id: '1l', pricePaise: 45000, stock: 12, enabled: true }, ownerToken],
      ['updateOrderStatus', { orderId: 'missing-order-123', status: 'packed' }, ownerToken],
    ] as const;
    for (const [method, data, token] of endpoints) {
      await rejectsCode(() => api(method, data, undefined, 'verified-test-appcheck'), 'AUTH_REQUIRED', 401);
      await rejectsCode(() => api(method, data, token), 'APP_CHECK_REQUIRED', 401);
      await rejectsCode(() => api(method, data, token, 'invalid-test-appcheck'), 'APP_CHECK_REQUIRED', 401);
    }
    await rejectsCode(() => api('quoteCheckout', request(), customerToken, 'verified-test-appcheck'), 'TESTER_REQUIRED', 403);
    await rejectsCode(() => api('quoteCheckout', { ...request(), tester: true }, customerToken, 'verified-test-appcheck'), 'TESTER_REQUIRED', 403);
    await rejectsCode(() => api('updateVariant', { id: '1l', pricePaise: 45000, stock: 12, enabled: true }, testerToken, 'verified-test-appcheck'), 'ADMIN_REQUIRED', 403);
    const quote = await api<QuoteResponse>('quoteCheckout', request(), testerToken, 'verified-test-appcheck');
    assert.equal(quote.preview, true);
    const placed = await api<{ orderId: string }>('placeCodOrder', { quoteId: quote.quoteId, idempotencyKey: 'verified-private-key' }, testerToken, 'verified-test-appcheck');
    await api('updateOrderStatus', { orderId: placed.orderId, status: 'packed' }, ownerToken, 'verified-test-appcheck');
    await api('updateVariant', { id: '2l', pricePaise: 90000, stock: 8, enabled: true }, ownerToken, 'verified-test-appcheck');
    assert.equal(await value(`commerceDraft/orderIndex/${placed.orderId}/status`), 'packed');
    assert.equal(await value(`commerce/orderIndex/${placed.orderId}`), null);
  });
  test('production never falls back to draft terms, quotes, orders or retry receipts', async () => {
    await initializeOrderablePrivateFixture();
    await db.ref('commerce').set(productionCommerce());
    const production = new CommerceService(db, { isEmulator: false, now: () => now });
    const draft = new CommerceService(peerDb, { isEmulator: false, stage: 'private-draft', now: () => now });
    const sharedKey = 'same-key-separate-stage';
    const draftQuote = await draft.quoteCheckout(tester, request());
    const draftOrder = await draft.placeCodOrder(tester, { quoteId: draftQuote.quoteId, idempotencyKey: sharedKey });
    await rejectsCode(() => production.placeCodOrder(customer, { quoteId: draftQuote.quoteId, idempotencyKey: sharedKey }), 'QUOTE_NOT_FOUND');
    await rejectsCode(() => production.updateOrderStatus(owner, { orderId: draftOrder.orderId, status: 'packed' }), 'ORDER_NOT_FOUND');
    const productionQuote = await production.quoteCheckout(customer, request());
    assert.equal(productionQuote.preview, false);
    const productionOrder = await production.placeCodOrder(customer, { quoteId: productionQuote.quoteId, idempotencyKey: sharedKey });
    assert.notEqual(productionOrder.orderId, draftOrder.orderId);
    assert.equal((await orderCopies(productionOrder.orderId)).preview, false);
    assert.deepEqual(await production.placeCodOrder(customer, { quoteId: productionQuote.quoteId, idempotencyKey: sharedKey }), productionOrder);
    assert.deepEqual(await draft.placeCodOrder(tester, { quoteId: draftQuote.quoteId, idempotencyKey: sharedKey }), draftOrder);
    await rejectsCode(() => draft.updateOrderStatus(owner, { orderId: productionOrder.orderId, status: 'packed' }), 'ORDER_NOT_FOUND');
    await stock(11);
    assert.equal(await value('commerceDraft/variants/1l/stock'), 11);
    await db.ref('commerce').remove();
    await rejectsCode(() => production.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    assert.equal(await value('commerce'), null, 'Missing production terms must not initialize or copy the draft ledger');
  });
  test('production rejects copied private samples, preview quote retries and preview order status updates', async () => {
    await initializeOrderablePrivateFixture();
    const draft = new CommerceService(db, { isEmulator: false, stage: 'private-draft', now: () => now });
    const quote = await draft.quoteCheckout(tester, request());
    const raw = { quoteId: quote.quoteId, idempotencyKey: 'copied-draft-receipt-key' };
    const order = await draft.placeCodOrder(tester, raw);
    await db.ref('commerce').set(await value('commerceDraft'));
    const production = new CommerceService(peerDb, { isEmulator: false, now: () => now });
    const baseline = await value('commerce');
    await rejectsCode(() => production.quoteCheckout(customer, request()), 'STORE_NOT_READY');
    await rejectsCode(() => production.placeCodOrder(customer, raw), 'STORE_NOT_READY');
    await rejectsCode(() => production.placeCodOrder(customer, { quoteId: quote.quoteId, idempotencyKey: 'copied-draft-new-key' }), 'STORE_NOT_READY');
    await rejectsCode(() => production.updateOrderStatus(owner, { orderId: order.orderId, status: 'packed' }), 'STORE_NOT_READY');
    await rejectsCode(() => production.updateVariant(owner, { id: '1l', pricePaise: 45000, stock: 11, enabled: true }), 'STORE_NOT_READY');
    assert.deepEqual(await value('commerce'), baseline);
    await db.ref('commerce').set({ ...productionCommerce(), publicContent: privateDraftCommerce().publicContent });
    await db.ref('commerce/publicContent/storefront/preview').set(false);
    await rejectsCode(() => production.quoteCheckout(customer, request()), 'STORE_NOT_READY', 409);
  });
  test('initialization is atomic, seeds only an absent draft, and preserves existing orders and personal data', async () => {
    const production = await value('commerce');
    const users = await value('users');
    const results = await Promise.all([initializePrivateDraft(db), initializePrivateDraft(peerDb)]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.deepEqual(await value('commerceDraft'), privateDraftCommerce());
    await enablePrivateOrderingFixture();
    const draft = new CommerceService(db, { isEmulator: false, stage: 'private-draft', now: () => now });
    const quote = await draft.quoteCheckout(tester, request());
    await draft.placeCodOrder(tester, { quoteId: quote.quoteId, idempotencyKey: 'seed-preserved-order-key' });
    const existing = await value('commerceDraft');
    assert.equal(await initializePrivateDraft(peerDb), false);
    assert.deepEqual(await value('commerceDraft'), existing);
    assert.deepEqual(await value('commerce'), production);
    assert.deepEqual(await value('users'), users);
  });
  test('health reports its stage and checks the storefront under that stage only', async () => {
    const draft = new CommerceService(db, { isEmulator: false, stage: 'private-draft', now: () => now });
    await startServer(draft, false);
    let health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 503);
    assert.equal(((await health.json()) as { stage: string }).stage, 'private-draft');
    await initializePrivateDraft(db);
    await db.ref('commerce').remove();
    health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    const draftHealth = await health.json() as { stage: string; checkout: string; onlinePaymentsEnabled: boolean };
    assert.equal(draftHealth.stage, 'private-draft');
    assert.equal(draftHealth.checkout, 'disabled');
    assert.equal(draftHealth.onlinePaymentsEnabled, false);
    await startServer(new CommerceService(db, { isEmulator: false, now: () => now }), false);
    health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 503);
    assert.equal(((await health.json()) as { stage: string }).stage, 'production');
  });
});
