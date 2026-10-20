import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HttpsError } from 'firebase-functions/v2/https';
import { assertNoLivePreview, assertTransition, calculateTotals, parseAddress, parseLines,
  parsePlaceRequest, parseQuoteRequest, parseStatusRequest, parseVariantRequest, requireAdmin, requirePhone,
  type DeliveryTerms, type MachineCode, type PackTerms } from '../src/model.js';
import { DEMO_PROJECT, PREVIEW_ADDRESS, requireDemoEmulators } from '../scripts/fixtures.js';

function errorCode(fn: () => unknown, expected: MachineCode) {
  assert.throws(fn, error => error instanceof HttpsError && (error.details as { code: string }).code === expected);
}
const quote = { lines: [{ id: '1l', quantity: 2 }], address: PREVIEW_ADDRESS, channel: 'web' };
const packs: PackTerms[] = [{ id: '1l', litres: 1, pricePaise: 45000, stock: 12, preview: true },
  { id: '5l', litres: 5, pricePaise: 225000, stock: 4, preview: true }];
const rule: DeliveryTerms = { feePaise: 12000, extraLitrePaise: 2500, includedLitres: 2,
  codAllowed: true, estimate: 'Preview', local: false, preview: true };

describe('contract input validation', () => {
  test('accepts and preserves Telugu names and valid Indian addresses', () => {
    assert.deepEqual(parseAddress(PREVIEW_ADDRESS), PREVIEW_ADDRESS);
    assert.equal(parseAddress({ ...PREVIEW_ADDRESS, street: '12 Preview Street\nSecond floor' }).street, '12 Preview Street\nSecond floor');
    assert.equal(parseQuoteRequest(quote).channel, 'web');
  });
  test('rejects extra client-supplied commercial and role fields', () => {
    errorCode(() => parseQuoteRequest({ ...quote, totalPaise: 1 }), 'INVALID_INPUT');
    errorCode(() => parseAddress({ ...PREVIEW_ADDRESS, admin: true }), 'INVALID_INPUT');
    errorCode(() => parseLines([{ id: '1l', quantity: 1, unitPricePaise: 1 }]), 'INVALID_INPUT');
    errorCode(() => parseQuoteRequest({ ...quote, channel: 'ios' }), 'INVALID_INPUT');
  });
  test('rejects empty, oversized, duplicate and unsupported pack lists', () => {
    for (const input of [[], Array(4).fill({ id: '1l', quantity: 1 }),
      [{ id: '1l', quantity: 1 }, { id: '1l', quantity: 2 }], [{ id: '10l', quantity: 1 }], null, {}]) {
      errorCode(() => parseLines(input), 'INVALID_INPUT');
    }
  });
  test('rejects non-integral, missing and out-of-range quantities', () => {
    for (const quantity of [0, 21, -1, 1.5, NaN, Infinity, '1', null, undefined]) {
      errorCode(() => parseLines([{ id: '1l', quantity }]), 'INVALID_INPUT');
    }
  });
  test('validates address lengths, mobile and exact PIN', () => {
    for (const patch of [{ name: 'x' }, { street: 'x' }, { city: 'x' }, { pin: '000000' }, { pin: '5232017' },
      { phone: '+916000000001' }, { phone: '5000000001' }, { name: 'x'.repeat(101) }, { street: 'x'.repeat(301) },
      { name: 'ab\u0000cd' }]) errorCode(() => parseAddress({ ...PREVIEW_ADDRESS, ...patch }), 'INVALID_INPUT');
  });
  test('requires a verified +91 phone claim, never a profile field', () => {
    errorCode(() => requirePhone(undefined), 'AUTH_REQUIRED');
    for (const phone_number of [undefined, '6000000001', '+12025550123', '+915000000001', 6000000001]) {
      errorCode(() => requirePhone({ uid: 'customer', token: { phone_number } }), 'PHONE_REQUIRED');
    }
    assert.equal(requirePhone({ uid: 'customer', token: { phone_number: '+916000000001' } }).phone, '+916000000001');
  });
  test('only a boolean trusted Auth admin claim authorizes administration', () => {
    errorCode(() => requireAdmin(undefined), 'AUTH_REQUIRED');
    for (const admin of [undefined, false, 'true', 1]) errorCode(() => requireAdmin({ uid: 'u', token: { admin } }), 'ADMIN_REQUIRED');
    assert.equal(requireAdmin({ uid: 'owner', token: { admin: true } }).uid, 'owner');
  });
  test('validates stable retry keys, rejects paths and extra payment methods', () => {
    assert.deepEqual(parsePlaceRequest({ quoteId: 'abcdefgh', idempotencyKey: 'retry_key-123' }), { quoteId: 'abcdefgh', idempotencyKey: 'retry_key-123' });
    for (const idempotencyKey of ['short', '../orders', 'a'.repeat(129), 1234, 'abcdefgh/123']) {
      errorCode(() => parsePlaceRequest({ quoteId: 'abcdefgh', idempotencyKey }), 'INVALID_INPUT');
    }
    errorCode(() => parsePlaceRequest({ quoteId: 'abcdefgh', idempotencyKey: 'abcdefgh', paymentMethod: 'upi' }), 'INVALID_INPUT');
  });
  test('validates owner prices, stock and statuses without coercion', () => {
    for (const patch of [{ pricePaise: 99 }, { pricePaise: 1000001 }, { stock: -1 }, { stock: 100001 },
      { enabled: 'true' }, { pricePaise: 45000.5 }]) {
      errorCode(() => parseVariantRequest({ id: '1l', pricePaise: 45000, stock: 12, enabled: true, ...patch }), 'INVALID_INPUT');
    }
    errorCode(() => parseStatusRequest({ orderId: 'abcdefgh', status: ['received'] }), 'INVALID_INPUT');
    errorCode(() => parseStatusRequest({ orderId: 'abcdefgh', status: 'refunded' }), 'INVALID_INPUT');
  });
});
describe('authoritative commerce math and transition policy', () => {
  test('charges integer paise and surcharge by litres while stock is packs', () => {
    const total = calculateTotals([{ id: '1l', quantity: 2 }, { id: '5l', quantity: 1 }], packs, rule);
    assert.equal(total.subtotalPaise, 315000);
    assert.equal(total.shippingPaise, 24500);
    assert.equal(total.totalPaise, 339500);
    assert.equal(total.lines[1]?.quantity, 1);
  });
  test('does not surcharge included litres or allow numeric overflow', () => {
    assert.equal(calculateTotals([{ id: '1l', quantity: 2 }], packs, rule).shippingPaise, 12000);
    errorCode(() => calculateTotals([{ id: '5l', quantity: 1 }], packs, { ...rule, extraLitrePaise: 100_000_000 }), 'STORE_NOT_READY');
    errorCode(() => calculateTotals([{ id: '5l', quantity: 5 }], packs, rule), 'OUT_OF_STOCK');
  });
  test('allows fulfillment and only received/packed cancellation, with same-state retries', () => {
    for (const [from, to] of [['received', 'packed'], ['packed', 'shipped'], ['shipped', 'delivered'],
      ['received', 'cancelled'], ['packed', 'cancelled'], ['cancelled', 'cancelled']] as const) assertTransition(from, to);
    for (const [from, to] of [['received', 'delivered'], ['packed', 'received'], ['shipped', 'cancelled'],
      ['delivered', 'cancelled'], ['cancelled', 'received']] as const) errorCode(() => assertTransition(from, to), 'INVALID_TRANSITION');
  });
  test('rejects all preview markers outside emulators', () => {
    assert.equal(assertNoLivePreview(true, [true]), true);
    assert.equal(assertNoLivePreview(false, [false, undefined]), false);
    errorCode(() => assertNoLivePreview(false, [false, true]), 'STORE_NOT_READY');
  });
  test('seed refuses missing, remote and real-project emulator configurations', () => {
    const env = { GCLOUD_PROJECT: DEMO_PROJECT, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' };
    assert.equal(requireDemoEmulators(env), DEMO_PROJECT);
    for (const patch of [{ GCLOUD_PROJECT: 'narayana-live' }, { FIRESTORE_EMULATOR_HOST: undefined },
      { FIREBASE_AUTH_EMULATOR_HOST: undefined }, { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' },
      { FIRESTORE_EMULATOR_HOST: 'http://localhost:8080' }]) assert.throws(() => requireDemoEmulators({ ...env, ...patch }), /Refusing fixture access/);
  });
});
