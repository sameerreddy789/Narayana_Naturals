import { StoreError, parseQuote, validateAddress, type CheckoutQuote } from "./commerce";
import type { Address } from "./demo";

export type CheckoutReview = { uid: string; quote: CheckoutQuote; key: string; address: Address; cartSignature: string; attempted: boolean };
type CheckoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorageAccess = () => CheckoutStorage;

export function checkoutStorageKey(uid: string): string { return "nn-checkout-web-v1-" + uid; }

export function parseCheckoutReview(raw: string | null, uid: string, cartSignature: string): CheckoutReview | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved) || saved.uid !== uid
      || typeof saved.key !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(saved.key)
      || typeof saved.cartSignature !== "string" || saved.cartSignature.length > 512
      || typeof saved.attempted !== "boolean" || (!saved.attempted && saved.cartSignature !== cartSignature)) return null;
    return { uid, quote: parseQuote(saved.quote), key: saved.key, address: validateAddress(saved.address), cartSignature: saved.cartSignature, attempted: saved.attempted };
  } catch { return null; }
}

export function readCheckoutReview(uid: string, cartSignature: string, getStorage: StorageAccess): CheckoutReview | null {
  let raw: string | null;
  try { raw = getStorage().getItem(checkoutStorageKey(uid)); }
  catch { throw new StoreError("CHECKOUT_RECOVERY_UNAVAILABLE"); }
  return parseCheckoutReview(raw, uid, cartSignature);
}

export function activeCheckoutReview(review: CheckoutReview | null, uid: string | null, cartSignature: string, address: Address): CheckoutReview | null {
  return review && review.uid === uid && (review.attempted || (review.cartSignature === cartSignature && JSON.stringify(review.address) === JSON.stringify(address))) ? review : null;
}

export function canReplaceCheckoutReview(review: CheckoutReview | null, uid: string | null, busy: boolean): boolean {
  return !!uid && !busy && !(review?.uid === uid && review.attempted);
}

export function checkoutHasContent(cartLength: number, review: CheckoutReview | null): boolean {
  return cartLength > 0 || review?.attempted === true;
}

export function saveCheckoutReview(review: CheckoutReview, getStorage: StorageAccess): void {
  try { getStorage().setItem(checkoutStorageKey(review.uid), JSON.stringify(review)); }
  catch { throw new StoreError("CHECKOUT_STORAGE_UNAVAILABLE"); }
}

export function retainCheckoutAttempt(review: CheckoutReview, getStorage: StorageAccess): CheckoutReview {
  const attempt = { ...review, attempted: true };
  // This write must finish before the order request can start.
  saveCheckoutReview(attempt, getStorage);
  return attempt;
}

export function removeCheckoutReview(uid: string, getStorage: StorageAccess): void {
  try { getStorage().removeItem(checkoutStorageKey(uid)); }
  catch { throw new StoreError("CHECKOUT_STORAGE_UNAVAILABLE"); }
}
