import assert from "node:assert/strict";
import { test } from "node:test";
import { money, readPreview, type Address } from "../src/lib/demo";
import { StoreError, errorCode, errorMessage, mergeCartEdit, mergeGuestCart, parseCart, parseOnboarding, parseOrder, parseQuote, parseSettings, removePurchasedLines, validateAddress } from "../src/lib/commerce";
import { activeCheckoutReview, canReplaceCheckoutReview, checkoutHasContent, checkoutStorageKey, parseCheckoutReview, readCheckoutReview, retainCheckoutAttempt, saveCheckoutReview, type CheckoutReview } from "../src/lib/checkout";

const address: Address = { name: "సమీర్ కుమార్", phone: "6000000001", street: "12, గాంధీ వీధి", city: "చిత్తూరు", pin: "517001" };
const lines = [{ id: "1l", quantity: 2, litres: 1, unitPricePaise: 45050 }];
const quote = { quoteId: "quote_abcdefgh", subtotalPaise: 90100, shippingPaise: 4000, totalPaise: 94100, codAllowed: true, estimate: "1–2 days", expiresAt: "2026-10-20T12:10:00.000Z", preview: true, lines };
const order = { id: "order_abcdefgh", uid: "customer-a", customerPhone: "+916000000001", createdAt: "2026-10-20T12:00:00.000Z", lines, address, subtotalPaise: 90100, shippingPaise: 4000, totalPaise: 94100, paymentMethod: "cod", paymentStatus: "pending_collection", status: "received", channel: "web", preview: true };
const isInvalid = (reason: unknown) => reason instanceof StoreError && ["INVALID_DATA", "INVALID_ADDRESS"].includes(reason.code);

test("Realtime Database omission of empty arrays restores an empty cart and guide without accepting malformed content", () => {
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(parseCart({ updatedAt: 1770000000000 }), []);
  assert.deepEqual(parseOnboarding({ welcomeSeen: true, skipped: true }), { welcomeSeen: true, skipped: true, dismissedPages: [] });
  assert.throws(() => parseCart({ lines: "invalid" }), isInvalid);
  assert.throws(() => parseOnboarding({ welcomeSeen: "true", skipped: true }), isInvalid);
});

test("RTDB epoch milliseconds preserve checkout expiry and order dates", () => {
  assert.deepEqual(parseQuote({ ...quote, expiresAt: Date.parse(quote.expiresAt) }), quote);
  assert.deepEqual(parseOrder(order.id, { ...order, createdAt: Date.parse(order.createdAt) }), order);
  assert.throws(() => parseQuote({ ...quote, expiresAt: Number.MAX_SAFE_INTEGER }), isInvalid);
  assert.throws(() => parseOrder(order.id, { ...order, createdAt: -1 }), isInvalid);
});

test("retrying a final cart quantity does not double an addition or overwrite a later app edit", () => {
  const before = parseCart({ lines: [{ id: "1l", quantity: 1 }] });
  const intended = parseCart({ lines: [{ id: "1l", quantity: 2 }] });
  assert.deepEqual(mergeCartEdit(before, before, intended), intended);
  assert.deepEqual(mergeCartEdit(intended, before, intended), intended);
  const later = parseCart({ lines: [{ id: "1l", quantity: 4 }, { id: "5l", quantity: 1 }] });
  assert.deepEqual(mergeCartEdit(later, before, intended), later);
});

test("post-order cleanup removes unchanged purchased packs while preserving later quantities and unrelated packs", () => {
  const purchased = parseCart({ lines: [{ id: "1l", quantity: 1 }, { id: "2l", quantity: 1 }] });
  const later = parseCart({ lines: [{ id: "1l", quantity: 2 }, { id: "2l", quantity: 1 }, { id: "5l", quantity: 1 }] });
  assert.deepEqual(removePurchasedLines(later, purchased), [{ id: "1l", quantity: 2 }, { id: "5l", quantity: 1 }]);
  assert.deepEqual(removePurchasedLines(purchased, purchased), []);
});

test("email demo identity, saved address and guidance survive reload without becoming an owner", () => {
  const uid = "demo_0123456789abcdef01234567";
  const restored = readPreview(JSON.stringify({ user: { uid, name: "Preview", email: "customer@narayana.test", phone: "", admin: true }, addresses: { [uid]: address }, welcomeSeen: [uid], dismissedTips: { [uid]: ["/shop"] } }));
  assert.equal(restored.user?.uid, uid);
  assert.equal(restored.user?.email, "customer@narayana.test");
  assert.equal(restored.user?.admin, false);
  assert.deepEqual(restored.addresses[uid], address);
  assert.deepEqual(restored.dismissedTips[uid], ["/shop"]);
});
const checkoutDraft = (): CheckoutReview => ({ uid: "customer-a", quote: parseQuote({ ...quote, expiresAt: "2000-01-01T00:00:00.000Z" }), key: "retry_abcdefgh", address, cartSignature: JSON.stringify([{ id: "1l", quantity: 2 }]), attempted: false });
function checkoutStorage() {
  const drafts = new Map<string, string>();
  return {
    drafts,
    getItem: (key: string) => drafts.get(key) ?? null,
    setItem: (key: string, value: string) => { drafts.set(key, value); },
    removeItem: (key: string) => { drafts.delete(key); },
  };
}

test("a missing saved cart preserves guest packs, and reapplying a merge does not duplicate quantities", () => {
  const guest = parseCart({ lines: [{ id: "1l", quantity: 3 }, { id: "5l", quantity: 1 }] });
  const saved = parseCart({ lines: [{ id: "1l", quantity: 2 }, { id: "2l", quantity: 4 }] });
  assert.deepEqual(mergeGuestCart(parseCart(undefined), guest), guest);
  const merged = mergeGuestCart(saved, guest);
  assert.deepEqual(merged, [{ id: "1l", quantity: 3 }, { id: "2l", quantity: 4 }, { id: "5l", quantity: 1 }]);
  assert.deepEqual(mergeGuestCart(merged, guest), merged);
  assert.deepEqual(saved, [{ id: "1l", quantity: 2 }, { id: "2l", quantity: 4 }]);
});

test("cart parsing rejects duplicate packs, unknown variants and invalid quantities", () => {
  for (const value of [
    { lines: [{ id: "1l", quantity: 1 }, { id: "1l", quantity: 2 }] },
    { lines: [{ id: "3l", quantity: 1 }] },
    { lines: [{ id: "1l", quantity: 21 }] },
    { lines: [{ id: "1l", quantity: 0 }] },
    { lines: [{ id: "1l", quantity: "2" }] },
  ]) assert.throws(() => parseCart(value), isInvalid);
});

test("Unicode addresses are accepted and persisted with only the canonical fields", () => {
  assert.deepEqual(validateAddress({ ...address, name: "  " + address.name + "  " }), address);
  assert.deepEqual(Object.keys(validateAddress({ ...address, unsafe: "extra" } as Address)).sort(), ["city", "name", "phone", "pin", "street"]);
  assert.throws(() => validateAddress({ ...address, phone: "1000000001" }), isInvalid);
  assert.throws(() => validateAddress({ ...address, pin: "051700" }), isInvalid);
});

test("integer paise are shown without rounding a valid price to the next rupee", () => {
  assert.equal(money(45000), "₹450");
  assert.equal(money(45050), "₹450.50");
  assert.equal(money(45001), "₹450.01");
});

test("quotes must have integer paise and matching authoritative totals", () => {
  assert.deepEqual(parseQuote(quote), quote);
  assert.throws(() => parseQuote({ ...quote, totalPaise: 94000 }), isInvalid);
  assert.throws(() => parseQuote({ ...quote, subtotalPaise: 90100.5 }), isInvalid);
  assert.throws(() => parseQuote({ ...quote, lines: [{ ...lines[0], litres: 2 }] }), isInvalid);
});

test("order parsing keeps the purchase snapshot and rejects simulated online payments", () => {
  assert.deepEqual(parseOrder(order.id, order), order);
  assert.equal(parseOrder(order.id, order)?.lines[0].unitPricePaise, 45050);
  assert.throws(() => parseOrder(order.id, { ...order, paymentMethod: "online", paymentStatus: "paid" }), isInvalid);
  assert.throws(() => parseOrder(order.id, { ...order, customerPhone: "6000000001" }), isInvalid);
  assert.deepEqual(parseOrder(order.id, { ...order, status: "cancelled", paymentStatus: "cancelled" })?.paymentStatus, "cancelled");
});

test("store settings cannot advertise an unimplemented online payment path", () => {
  assert.equal(parseSettings({ orderingEnabled: true, onlinePaymentsEnabled: false, preview: true })?.onlinePaymentsEnabled, false);
  assert.throws(() => parseSettings({ orderingEnabled: true, onlinePaymentsEnabled: true, preview: false }), isInvalid);
});

test("REST machine errors take priority and preserve useful permission and Telugu messages", () => {
  assert.equal(errorCode({ code: "failed-precondition", details: { code: "QUOTE_CHANGED" } }), "QUOTE_CHANGED");
  assert.match(errorMessage({ code: "database/permission-denied" }, en => en), /cannot access/);
  assert.match(errorMessage({ code: "QUOTE_CHANGED" }, (_en, te) => te), /ధరలు/);
});

test("legacy demo records migrate to demo UIDs without granting owner access", () => {
  const migrated = readPreview(JSON.stringify({ user: { name: "Preview", phone: "6000000001", admin: true }, addresses: { "6000000001": address }, welcomeSeen: ["6000000001"], dismissedTips: { "6000000001": ["/shop"] } }));
  assert.equal(migrated.user?.uid, "demo_6000000001");
  assert.equal(migrated.user?.admin, false);
  assert.deepEqual(migrated.addresses.demo_6000000001, address);
  assert.deepEqual(migrated.dismissedTips.demo_6000000001, ["/shop"]);
  assert.deepEqual(migrated.welcomeSeen, ["demo_6000000001"]);
});

test("an interrupted order restores its expired quote and retry key after another device clears or replaces the cart", () => {
  const storage = checkoutStorage();
  const draft = checkoutDraft();
  const attempted = retainCheckoutAttempt(draft, () => storage);
  for (const cartSignature of ["[]", JSON.stringify([{ id: "5l", quantity: 1 }])]) {
    const restored = readCheckoutReview(draft.uid, cartSignature, () => storage);
    assert.deepEqual(restored, attempted);
    const active = activeCheckoutReview(restored, draft.uid, cartSignature, { ...address, street: "A different street" });
    assert.equal(active?.key, draft.key);
    assert.deepEqual(active?.quote.lines, lines);
    assert.equal(checkoutHasContent(0, active), true);
    assert.equal(canReplaceCheckoutReview(restored, draft.uid, false), false);
  }
  assert.equal(draft.attempted, false);
});

test("programmatic address edits and form resubmissions cannot replace a pending attempt", () => {
  const draft = checkoutDraft();
  const pending = { ...draft, attempted: true };
  assert.equal(canReplaceCheckoutReview(pending, draft.uid, false), false);
  assert.equal(canReplaceCheckoutReview(pending, draft.uid, true), false);
  assert.equal(canReplaceCheckoutReview(draft, draft.uid, true), false);
  assert.equal(canReplaceCheckoutReview(draft, draft.uid, false), true);
  assert.equal(canReplaceCheckoutReview(pending, null, false), false);
});

test("sign-out and another UID hide an attempt without erasing the draft needed on same-UID return", () => {
  const storage = checkoutStorage();
  const draft = checkoutDraft();
  const pending = retainCheckoutAttempt(draft, () => storage);
  const original = storage.getItem(checkoutStorageKey(draft.uid));
  assert.equal(activeCheckoutReview(pending, null, "[]", address), null);
  assert.equal(activeCheckoutReview(pending, "customer-b", "[]", address), null);
  assert.equal(readCheckoutReview("customer-b", "[]", () => storage), null);
  assert.equal(storage.getItem(checkoutStorageKey(draft.uid)), original);
  assert.deepEqual(readCheckoutReview(draft.uid, "[]", () => storage), pending);
  assert.deepEqual(readCheckoutReview(draft.uid, "[]", () => storage), pending);
  assert.equal(storage.getItem(checkoutStorageKey(draft.uid)), original);
});

test("an unsubmitted review is invalidated by cart or address changes and malformed browser drafts cannot authorize ordering", () => {
  const draft = checkoutDraft();
  assert.deepEqual(parseCheckoutReview(JSON.stringify(draft), draft.uid, draft.cartSignature), draft);
  assert.equal(parseCheckoutReview(JSON.stringify(draft), draft.uid, "[]"), null);
  assert.equal(activeCheckoutReview(draft, draft.uid, draft.cartSignature, { ...address, pin: "517501" }), null);
  assert.equal(checkoutHasContent(0, null), false);
  for (const raw of ["not json", JSON.stringify({ ...draft, attempted: "true" }), JSON.stringify({ ...draft, key: "bad" }), JSON.stringify({ ...draft, quote: { ...draft.quote, totalPaise: 1 } })]) {
    assert.equal(parseCheckoutReview(raw, draft.uid, draft.cartSignature), null);
  }
});

test("an attempted key is written synchronously before an order request can begin", () => {
  const storage = checkoutStorage();
  const draft = checkoutDraft();
  saveCheckoutReview(draft, () => storage);
  const attempt = retainCheckoutAttempt(draft, () => storage);
  const beforeRequest = JSON.parse(storage.getItem(checkoutStorageKey(draft.uid))!);
  assert.equal(beforeRequest.attempted, true);
  assert.equal(beforeRequest.key, draft.key);
  assert.deepEqual(readCheckoutReview(draft.uid, "[]", () => storage), attempt);
});

test("blocked browser storage stops submission before sending an order and reports a recoverable restoration error", () => {
  const draft = checkoutDraft();
  const storage = checkoutStorage();
  const blocked = { ...storage, setItem: () => { throw new Error("Storage blocked"); } };
  let orderRequests = 0;
  const submit = () => { retainCheckoutAttempt(draft, () => blocked); orderRequests += 1; };
  assert.throws(submit, reason => reason instanceof StoreError && reason.code === "CHECKOUT_STORAGE_UNAVAILABLE");
  assert.equal(orderRequests, 0);
  assert.equal(draft.attempted, false);
  assert.equal(storage.getItem(checkoutStorageKey(draft.uid)), null);
  assert.throws(() => retainCheckoutAttempt(draft, () => { throw new Error("Storage access denied"); }), reason => reason instanceof StoreError && reason.code === "CHECKOUT_STORAGE_UNAVAILABLE");
  assert.throws(() => readCheckoutReview(draft.uid, "[]", () => { throw new Error("Storage access denied"); }), reason => reason instanceof StoreError && reason.code === "CHECKOUT_RECOVERY_UNAVAILABLE");
  assert.match(errorMessage(new StoreError("CHECKOUT_STORAGE_UNAVAILABLE"), en => en), /No order request was sent/);
});
