import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { DEMO_PROJECT, PREVIEW_ADDRESS, requireDemoEmulators } from '../scripts/fixtures.js';

let env: RulesTestEnvironment;
before(async () => {
  requireDemoEmulators();
  const host = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
  env = await initializeTestEnvironment({ projectId: DEMO_PROJECT,
    firestore: { host: host.hostname, port: Number(host.port), rules: readFileSync(resolve(__dirname, '../../../firebase/firestore.rules'), 'utf8') } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'products/groundnut-oil'), { published: true, preview: true });
    batch.set(doc(db, 'products/groundnut-oil/variants/1l'), { id: '1l', litres: 1, pricePaise: 45000, stock: 12, enabled: false });
    batch.set(doc(db, 'products/hidden-product'), { published: false });
    batch.set(doc(db, 'products/hidden-product/variants/1l'), { id: '1l', pricePaise: 1 });
    batch.set(doc(db, 'publicContent/storefront'), { preview: true, orderingEnabled: true, onlinePaymentsEnabled: false });
    batch.set(doc(db, 'deliveryRules/523201'), { enabled: true, feePaise: 0 });
    batch.set(doc(db, 'deliveryRules/500001'), { enabled: false, feePaise: 12000 });
    batch.set(doc(db, 'users/customer'), { displayName: 'Customer', phoneNumber: '+916000000001', language: 'en' });
    batch.set(doc(db, 'users/customer/addresses/default'), PREVIEW_ADDRESS);
    batch.set(doc(db, 'users/customer/onboarding/web-v1'), { welcomeSeen: true, skipped: false, dismissedPages: ['home'] });
    batch.set(doc(db, 'carts/customer'), { lines: [{ id: '1l', quantity: 1 }], updatedAt: Timestamp.now() });
    batch.set(doc(db, 'orders/order-customer-123'), { id: 'order-customer-123', uid: 'customer', status: 'received', createdAt: '2026-10-20T00:00:00.000Z' });
    batch.set(doc(db, 'orders/order-other-123'), { id: 'order-other-123', uid: 'other', status: 'received', createdAt: '2026-10-20T01:00:00.000Z' });
    for (const path of ['_inventory/1l', '_checkoutQuotes/quote-test-123', '_orderRequests/key-test-123', '_checkoutLimits/limit-test-123']) {
      batch.set(doc(db, path), { secret: true });
    }
    await batch.commit();
  });
});
const customer = () => env.authenticatedContext('customer', { phone_number: '+916000000001' }).firestore();
const other = () => env.authenticatedContext('other', { phone_number: '+916000000002' }).firestore();
const owner = () => env.authenticatedContext('owner', { admin: true }).firestore();

describe('public catalogue and denied commercial writes', () => {
  test('guests read published products, variants and storefront, but not drafts', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'products/groundnut-oil')));
    await assertSucceeds(getDoc(doc(db, 'products/groundnut-oil/variants/1l')));
    await assertSucceeds(getDoc(doc(db, 'publicContent/storefront')));
    await assertSucceeds(getDocs(query(collection(db, 'products'), where('published', '==', true))));
    await assertFails(getDoc(doc(db, 'products/hidden-product')));
    await assertFails(getDoc(doc(db, 'products/hidden-product/variants/1l')));
    await assertFails(getDocs(collection(db, 'products')));
  });
  test('PIN rules are readable by exact enabled PIN, not unrestricted listing', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'deliveryRules/523201')));
    await assertFails(getDoc(doc(db, 'deliveryRules/500001')));
    await assertFails(getDocs(collection(db, 'deliveryRules')));
  });
  test('even admin clients cannot write prices, stock, delivery, storefront or orders', async () => {
    for (const db of [customer(), owner(), env.unauthenticatedContext().firestore()]) {
      for (const path of ['products/groundnut-oil', 'products/groundnut-oil/variants/1l', 'publicContent/storefront',
        'deliveryRules/523201', 'orders/order-customer-123']) await assertFails(setDoc(doc(db, path), { hacked: true }));
      await assertFails(deleteDoc(doc(db, 'orders/order-customer-123')));
    }
  });
});
describe('customer document ownership and strict schemas', () => {
  test('profiles require verified phone, allowed language, bounded name and no self-granted role', async () => {
    const db = customer();
    const profile = { displayName: 'సమీర్', phoneNumber: '+916000000001', language: 'te' };
    await assertSucceeds(setDoc(doc(db, 'users/customer'), profile));
    for (const patch of [{ admin: true }, { phoneNumber: '+916000000002' }, { language: 'fr' },
      { displayName: 'x' }, { email: 'extra@example.invalid' }]) await assertFails(setDoc(doc(db, 'users/customer'), { ...profile, ...patch }));
    await assertFails(setDoc(doc(env.authenticatedContext('no-phone').firestore(), 'users/no-phone'), profile));
    await assertFails(getDoc(doc(other(), 'users/customer')));
    await assertFails(updateDoc(doc(other(), 'users/customer'), { displayName: 'Changed' }));
    await assertFails(getDoc(doc(owner(), 'users/customer')));
    await assertFails(getDocs(collection(db, 'users')));
  });
  test('only the owned default address accepts a strict Unicode address', async () => {
    const db = customer();
    await assertSucceeds(setDoc(doc(db, 'users/customer/addresses/default'), PREVIEW_ADDRESS));
    await assertSucceeds(getDoc(doc(db, 'users/customer/addresses/default')));
    await assertFails(getDoc(doc(other(), 'users/customer/addresses/default')));
    await assertFails(setDoc(doc(db, 'users/customer/addresses/second'), PREVIEW_ADDRESS));
    for (const patch of [{ pin: '000000' }, { phone: '1234567890' }, { country: 'India' }, { street: 'x' }]) {
      await assertFails(setDoc(doc(db, 'users/customer/addresses/default'), { ...PREVIEW_ADDRESS, ...patch }));
    }
  });
  test('carts allow only unique bounded pack quantities and a server timestamp', async () => {
    const db = customer();
    const ref = doc(db, 'carts/customer');
    await assertSucceeds(setDoc(ref, { lines: [{ id: '1l', quantity: 2 }, { id: '5l', quantity: 1 }], updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(ref, { lines: [], updatedAt: serverTimestamp() }));
    for (const lines of [[{ id: '1l', quantity: 0 }], [{ id: '1l', quantity: 21 }], [{ id: '1l', quantity: 1.5 }],
      [{ id: '1l', quantity: 1 }, { id: '1l', quantity: 1 }], [{ id: '1l', quantity: 1, pricePaise: 1 }],
      [{ id: '10l', quantity: 1 }], Array(4).fill({ id: '1l', quantity: 1 })]) {
      await assertFails(setDoc(ref, { lines, updatedAt: serverTimestamp() }));
    }
    await assertFails(setDoc(ref, { lines: [], updatedAt: Timestamp.fromMillis(1) }));
    await assertFails(setDoc(ref, { lines: [], updatedAt: serverTimestamp(), totalPaise: 1 }));
    await assertFails(getDoc(doc(other(), 'carts/customer')));
    await assertFails(setDoc(doc(other(), 'carts/customer'), { lines: [], updatedAt: serverTimestamp() }));
  });
  test('onboarding is owned and versioned, with bounded distinct string page IDs', async () => {
    const db = customer();
    const guide = { welcomeSeen: true, skipped: false, dismissedPages: ['home', 'product'] };
    await assertSucceeds(setDoc(doc(db, 'users/customer/onboarding/android-v1'), guide));
    await assertFails(setDoc(doc(db, 'users/customer/onboarding/arbitrary-v9'), guide));
    await assertFails(getDoc(doc(other(), 'users/customer/onboarding/web-v1')));
    for (const patch of [{ welcomeSeen: 1 }, { dismissedPages: ['home', 'home'] }, { dismissedPages: [1] },
      { dismissedPages: ['x'.repeat(65)] }, { admin: true }, { dismissedPages: Array.from({ length: 21 }, (_, i) => String(i)) }]) {
      await assertFails(setDoc(doc(db, 'users/customer/onboarding/web-v1'), { ...guide, ...patch }));
    }
  });
});
describe('order query ownership and server-only internal records', () => {
  test('owners and admin claimants read orders; other accounts and guests cannot', async () => {
    await assertSucceeds(getDoc(doc(customer(), 'orders/order-customer-123')));
    await assertSucceeds(getDoc(doc(owner(), 'orders/order-customer-123')));
    await assertFails(getDoc(doc(other(), 'orders/order-customer-123')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'orders/order-customer-123')));
    await assertFails(getDoc(doc(env.authenticatedContext('fake-owner', { admin: 'true' }).firestore(), 'orders/order-customer-123')));
  });
  test('customer lists need UID filter, and all lists require a bounded limit', async () => {
    const db = customer();
    const result = await assertSucceeds(getDocs(query(collection(db, 'orders'), where('uid', '==', 'customer'), orderBy('createdAt', 'desc'), limit(50))));
    assert.equal(result.size, 1);
    await assertSucceeds(getDocs(query(collection(owner(), 'orders'), orderBy('createdAt', 'desc'), limit(100))));
    await assertFails(getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50))));
    await assertFails(getDocs(query(collection(db, 'orders'), where('uid', '==', 'customer'), orderBy('createdAt', 'desc'))));
    await assertFails(getDocs(query(collection(owner(), 'orders'), orderBy('createdAt', 'desc'), limit(101))));
  });
  test('private inventory, quotes, retry keys, limits and unknown collections deny all client access', async () => {
    for (const db of [customer(), owner(), env.unauthenticatedContext().firestore()]) {
      for (const path of ['_inventory/1l', '_checkoutQuotes/quote-test-123', '_orderRequests/key-test-123',
        '_checkoutLimits/limit-test-123', 'unknown/doc-test']) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { uid: 'customer', hacked: true }));
      }
    }
  });
});
