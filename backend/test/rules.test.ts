import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { DEMO_PROJECT, PREVIEW_ADDRESS, PREVIEW_USERS, previewCommerce, requireDemoEmulators } from '../scripts/fixtures.js';

let env: RulesTestEnvironment;
const customerUid = PREVIEW_USERS.customer.uid;
const otherUid = PREVIEW_USERS.other.uid;
const orderId = 'order-customer-123';
const profile = { displayName: 'సమీర్', email: PREVIEW_USERS.customer.email, language: 'te' };
const customer = () => env.authenticatedContext(customerUid, { email: PREVIEW_USERS.customer.email }).database();
const other = () => env.authenticatedContext(otherUid, { email: PREVIEW_USERS.other.email }).database();
const owner = () => env.authenticatedContext(PREVIEW_USERS.owner.uid, { email: PREVIEW_USERS.owner.email, admin: true }).database();
const guest = () => env.unauthenticatedContext().database();

before(async () => {
  requireDemoEmulators();
  const host = new URL(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`);
  assert.equal(host.port, '9100', 'Rules tests may reset only the isolated test database on port 9100');
  assert.equal(new URL(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`).port, '9199', 'Rules tests require the isolated Auth configuration');
  env = await initializeTestEnvironment({ projectId: DEMO_PROJECT,
    database: { host: host.hostname, port: Number(host.port), rules: readFileSync(resolve(__dirname, '../../../firebase/database.rules.json'), 'utf8') } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async context => {
    const customerOrder = { id: orderId, uid: customerUid, status: 'received', createdAt: Date.now(), totalPaise: 45000 };
    const otherOrder = { id: 'order-other-123', uid: otherUid, status: 'received', createdAt: Date.now() + 1000, totalPaise: 90000 };
    await context.database().ref().set({
      commerce: { ...previewCommerce(),
        ordersByUser: { [customerUid]: { [orderId]: customerOrder }, [otherUid]: { [otherOrder.id]: otherOrder } },
        orderIndex: { [orderId]: customerOrder, [otherOrder.id]: otherOrder },
        quotes: { 'private-quote-123': { uid: customerUid, secret: true } },
        idempotency: { 'private-receipt-123': { uid: customerUid, secret: true } },
        limits: { 'private-limit-123': { count: 1, startedAt: Date.now() } },
      },
      users: { [customerUid]: { profile, addresses: { default: PREVIEW_ADDRESS },
        onboarding: { 'web-v1': { welcomeSeen: true, skipped: false, dismissedPages: ['home'] } } } },
      carts: { [customerUid]: { lines: [{ id: '1l', quantity: 1 }], updatedAt: Date.now() } },
    });
  });
});

describe('public RTDB reads and server-only commerce writes', () => {
  test('guests read the published product, pack catalogue, storefront and exact PIN rules', async () => {
    const db = guest();
    for (const path of ['commerce/products/groundnut-oil', 'commerce/variants', 'commerce/variants/1l',
      'commerce/publicContent/storefront', 'commerce/deliveryRules/517001', 'commerce/deliveryRules/500001']) {
      assert.ok((await assertSucceeds(db.ref(path).once('value'))).exists(), path);
    }
    await assertFails(db.ref('commerce').once('value'));
    await assertFails(db.ref('commerce/products').once('value'));
    await assertFails(db.ref('commerce/deliveryRules').once('value'));
    await env.withSecurityRulesDisabled(context => context.database().ref('commerce/products/groundnut-oil/published').set(false));
    await assertFails(db.ref('commerce/products/groundnut-oil').once('value'));
  });
  test('customers, guests and admin clients cannot directly edit prices, stock, rules, content or either order copy', async () => {
    for (const db of [customer(), owner(), guest()]) {
      for (const path of ['commerce/products/groundnut-oil', 'commerce/variants/1l/stock', 'commerce/variants/1l/pricePaise',
        'commerce/publicContent/storefront', 'commerce/deliveryRules/517001', `commerce/orderIndex/${orderId}`,
        `commerce/ordersByUser/${customerUid}/${orderId}`]) {
        await assertFails(db.ref(path).set({ hacked: true }));
      }
      await assertFails(db.ref(`commerce/orderIndex/${orderId}`).remove());
      await assertFails(db.ref(`commerce/ordersByUser/${customerUid}/${orderId}/status`).set('delivered'));
      await assertFails(db.ref().update({ 'commerce/variants/1l/stock': 999, [`commerce/orderIndex/${orderId}/status`]: 'cancelled' }));
    }
  });
});

describe('UID isolation and strict customer data schemas', () => {
  test('customer profiles use the Auth email, allow Telugu and cannot grant a role or delete required fields', async () => {
    const db = customer();
    const ref = db.ref(`users/${customerUid}/profile`);
    await assertSucceeds(ref.set({ ...profile, phoneNumber: '+916000000001' }));
    await assertSucceeds(ref.once('value'));
    for (const patch of [{ admin: true }, { role: 'owner' }, { email: PREVIEW_USERS.other.email }, { language: 'fr' },
      { displayName: 123 }, { displayName: 'x'.repeat(101) }, { phoneNumber: '+915000000001' }]) {
      await assertFails(ref.set({ ...profile, ...patch }));
    }
    await assertFails(ref.set({ displayName: profile.displayName, language: 'te' }));
    await assertFails(ref.child('email').remove());
    await assertFails(ref.remove());
    await assertFails(db.ref(`users/${customerUid}/admin`).set(true));
    await assertFails(db.ref(`users/${customerUid}/role`).set('owner'));
    const noEmail = env.authenticatedContext('anonymous-profile').database();
    await assertFails(noEmail.ref('users/anonymous-profile/profile').set(profile));
  });
  test('other users, guests and the admin claim cannot access a customer profile, address, cart or onboarding', async () => {
    for (const db of [other(), owner(), guest()]) {
      for (const [path, data] of [
        [`users/${customerUid}/profile`, profile], [`users/${customerUid}/addresses/default`, PREVIEW_ADDRESS],
        [`carts/${customerUid}`, { lines: [], updatedAt: Date.now() }],
        [`users/${customerUid}/onboarding/web-v1`, { welcomeSeen: true, skipped: false }],
      ] as const) {
        await assertFails(db.ref(path).once('value'));
        await assertFails(db.ref(path).set(data));
      }
    }
    await assertFails(customer().ref('users').once('value'));
    await assertFails(customer().ref(`users/${customerUid}`).once('value'));
    await assertFails(customer().ref('carts').once('value'));
  });
  test('only the owned default address accepts bounded Indian delivery fields', async () => {
    const db = customer();
    const ref = db.ref(`users/${customerUid}/addresses/default`);
    await assertSucceeds(ref.set(PREVIEW_ADDRESS));
    await assertSucceeds(ref.once('value'));
    for (const patch of [{ name: 'x' }, { name: 123 }, { name: 'x'.repeat(101) }, { street: 'x' },
      { street: 'x'.repeat(301) }, { city: 'x' }, { pin: '000000' }, { pin: 517001 }, { pin: '5170017' },
      { phone: '5000000001' }, { phone: '+916000000001' }, { country: 'India' }, { totalPaise: 1 }]) {
      await assertFails(ref.set({ ...PREVIEW_ADDRESS, ...patch }));
    }
    await assertFails(ref.set({ name: 'Customer', phone: PREVIEW_ADDRESS.phone, pin: PREVIEW_ADDRESS.pin }));
    await assertFails(db.ref(`users/${customerUid}/addresses/second`).set(PREVIEW_ADDRESS));
    await assertSucceeds(ref.remove());
  });
  test('carts permit unique pack quantities and epoch milliseconds, including an empty cart', async () => {
    const ref = customer().ref(`carts/${customerUid}`);
    await assertSucceeds(ref.set({ lines: [{ id: '1l', quantity: 2 }, { id: '5l', quantity: 1 }], updatedAt: Date.now() }));
    await assertSucceeds(ref.set({ lines: [], updatedAt: Date.now() }));
    for (const lines of [[{ id: '1l', quantity: 0 }], [{ id: '1l', quantity: 21 }], [{ id: '1l', quantity: 1.5 }],
      [{ id: '1l', quantity: '1' }], [{ id: '10l', quantity: 1 }], [{ id: '1l' }],
      [{ id: '1l', quantity: 1 }, { id: '1l', quantity: 2 }],
      [{ id: '1l', quantity: 1 }, { id: '2l', quantity: 1 }, { id: '1l', quantity: 1 }],
      [{ id: '1l', quantity: 1 }, { id: '2l', quantity: 1 }, { id: '2l', quantity: 1 }],
      [{ id: '1l', quantity: 1, unitPricePaise: 1 }], Array(4).fill({ id: '1l', quantity: 1 }), 'invalid-lines']) {
      await assertFails(ref.set({ lines, updatedAt: Date.now() }));
    }
    for (const updatedAt of [-1, '2026-10-20T10:00:00.000Z', Date.now() + 60_000]) {
      await assertFails(ref.set({ lines: [], updatedAt }));
    }
    await assertFails(ref.set({ lines: [] }));
    await assertFails(ref.set({ lines: [], updatedAt: Date.now(), totalPaise: 1 }));
    await assertFails(ref.remove());
  });
  test('onboarding writes are owned, versioned and validate boolean flags and bounded page IDs', async () => {
    const db = customer();
    const guide = { welcomeSeen: true, skipped: false, dismissedPages: ['home', 'product'] };
    const ref = db.ref(`users/${customerUid}/onboarding/android-v1`);
    await assertSucceeds(ref.set(guide));
    await assertSucceeds(ref.once('value'));
    await assertFails(db.ref(`users/${customerUid}/onboarding/arbitrary-v9`).set(guide));
    for (const patch of [{ welcomeSeen: 1 }, { skipped: 'false' }, { dismissedPages: [1] },
      { dismissedPages: ['x'.repeat(65)] }, { dismissedPages: Array(25).fill('page') }, { admin: true }]) {
      await assertFails(ref.set({ ...guide, ...patch }));
    }
    await assertFails(ref.set({ welcomeSeen: true }));
  });
});

describe('order ownership and server-private records', () => {
  test('customers read their indexed history and admin claims read both order views', async () => {
    const history = await assertSucceeds(customer().ref(`commerce/ordersByUser/${customerUid}`).orderByChild('createdAt').limitToLast(50).once('value'));
    assert.equal(history.numChildren(), 1);
    assert.equal(history.child(orderId).val().uid, customerUid);
    await assertSucceeds(owner().ref(`commerce/ordersByUser/${customerUid}/${orderId}`).once('value'));
    const index = await assertSucceeds(owner().ref('commerce/orderIndex').orderByChild('createdAt').limitToLast(100).once('value'));
    assert.equal(index.numChildren(), 2);
    await assertFails(customer().ref('commerce/orderIndex').once('value'));
    await assertFails(customer().ref('commerce/ordersByUser').once('value'));
  });
  test('foreign accounts, guests and string admin claims cannot read another customer order', async () => {
    const fakeOwner = env.authenticatedContext('fake-owner', { email: 'fake@example.test', admin: 'true' }).database();
    for (const db of [other(), guest(), fakeOwner]) {
      await assertFails(db.ref(`commerce/ordersByUser/${customerUid}/${orderId}`).once('value'));
      await assertFails(db.ref('commerce/orderIndex').once('value'));
    }
  });
  test('quote contents, retry receipts, rate limits and unknown paths deny every client including admin', async () => {
    for (const db of [customer(), owner(), guest()]) {
      for (const path of ['commerce/quotes', 'commerce/quotes/private-quote-123', 'commerce/idempotency',
        'commerce/idempotency/private-receipt-123', 'commerce/limits', 'commerce/limits/private-limit-123', 'unknown/private']) {
        await assertFails(db.ref(path).once('value'));
        await assertFails(db.ref(path).set({ hacked: true }));
      }
    }
  });
});
