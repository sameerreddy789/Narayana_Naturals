"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle, ArrowRight, Check, X } from "lucide-react";
import { createUserWithEmailAndPassword, onIdTokenChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type Unsubscribe, type User } from "firebase/auth";
import { limitToLast, onValue, orderByChild, query, ref, runTransaction, serverTimestamp, set } from "firebase/database";
import { BrandLogo } from "./brand-logo";
import { cartSubtotal, deliveryQuote, initialPreview, readPreview, type Address, type CartLine, type DemoOrder, type Language, type PackId, type PreviewState, type Variant } from "@/lib/demo";
import { DEMO_PRODUCT, EMPTY_ONBOARDING, PACK_IDS, StoreError, errorMessage, mergeCartEdit, mergeGuestCart, removePurchasedLines, parseCart, parseOnboarding, parseOrder, parseProduct, parseQuote, parseSettings, parseVariant, validateAddress, type CheckoutQuote, type DeliveryCheck, type Onboarding, type Product, type StorefrontSettings } from "@/lib/commerce";
import { assertCurrentStoreRecord, backendMode, commerceApi, commerceRoot, databaseRecords, getFirebaseServices, getServerValue, privateDraft, waitDatabaseConnection, type BackendMode } from "@/lib/firebase";
import { assertDemoBillCurrent, cartQuantityLimit, demoReceiptKey, makeDemoBill, persistDemoReceipt, readDemoReceipts, type DemoBill, type LocalDemoReceipt } from "@/lib/demo-checkout";

const DEMO_STORAGE_KEY = "narayana-naturals-preview-v2";
const GUEST_STORAGE_KEY = "narayana-naturals-web-guest-v1";
type Toast = { message: string; error: boolean };
type Context = {
  state: PreviewState;
  demoReceipts: LocalDemoReceipt[];
  mode: BackendMode;
  ready: boolean;
  accountReady: boolean;
  catalogueReady: boolean;
  catalogueAvailable: boolean;
  ordersReady: boolean;
  ownerOrdersReady: boolean;
  ownerOrders: DemoOrder[];
  cartBusy: boolean;
  guideBusy: boolean;
  offline: boolean;
  product: Product | null;
  settings: StorefrontSettings | null;
  catalogueError: string;
  accountError: string;
  ordersError: string;
  ownerError: string;
  connectionError: string;
  t: (english: string, telugu: string) => string;
  explainError: (reason: unknown) => string;
  toggleLanguage: () => Promise<void>;
  addPack: (id: PackId, quantity?: number) => Promise<boolean>;
  setQuantity: (id: PackId, quantity: number) => Promise<void>;
  login: (credentials: { email: string; password: string; name?: string; createAccount?: boolean }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  dismissTip: (page: string) => Promise<void>;
  skipGuide: () => Promise<void>;
  replayGuide: () => Promise<void>;
  saveAddress: (address: Address) => Promise<void>;
  quoteDemoCheckout: (address: Address) => Promise<DemoBill>;
  confirmDemoPayment: (bill: DemoBill) => Promise<string>;
  updateVariant: (variant: Variant) => Promise<void>;
  updateOrder: (id: string, status: DemoOrder["status"]) => Promise<void>;
  checkDelivery: (pin: string, lines: CartLine[]) => Promise<DeliveryCheck>;
  quoteCheckout: (address: Address) => Promise<CheckoutQuote>;
  placeOrder: (quote: CheckoutQuote, idempotencyKey: string) => Promise<string>;
  watchOrder: (id: string, receive: (order: DemoOrder | null) => void, fail: (reason: unknown) => void, owner?: boolean) => Unsubscribe;
  retryConnection: () => void;
  notify: (message: string, error?: boolean) => void;
};

const PreviewContext = createContext<Context | null>(null);
export function usePreview() {
  const context = useContext(PreviewContext);
  if (!context) throw new Error("PreviewProvider is missing");
  return context;
}

export function guidePageKey(page: string): string {
  if (page.startsWith("/account/orders/")) return "/account/orders/:id";
  if (page.startsWith("/order-result/")) return "/order-result/:id";
  return page.slice(0, 64);
}

function deadline<T>(operation: Promise<T>, milliseconds = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new StoreError("deadline-exceeded")), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, reason => { clearTimeout(timer); reject(reason); });
  });
}

function newState(): PreviewState {
  const state = initialPreview();
  return backendMode === "demo" ? state : { ...state, variants: [] };
}

function parseStoreOrder(id: string, data: unknown): DemoOrder | null {
  return assertCurrentStoreRecord(parseOrder(id, data));
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(newState);
  const stateRef = useRef(state);
  const [demoReceipts, setDemoReceipts] = useState<LocalDemoReceipt[]>([]);
  const [ready, setReady] = useState(false);
  const [accountReady, setAccountReady] = useState(backendMode === "demo");
  const accountReadyRef = useRef(backendMode === "demo");
  const [catalogueReady, setCatalogueReady] = useState(backendMode === "demo");
  const [product, setProduct] = useState<Product | null>(backendMode === "demo" ? DEMO_PRODUCT : null);
  const [settings, setSettings] = useState<StorefrontSettings | null>(backendMode === "demo" ? { orderingEnabled: true, onlinePaymentsEnabled: false, preview: true } : null);
  const [catalogueIssues, setCatalogueIssues] = useState<Record<string, unknown>>({});
  const [accountIssue, setAccountIssue] = useState<unknown>();
  const [ordersIssue, setOrdersIssue] = useState<unknown>();
  const [ownerIssue, setOwnerIssue] = useState<unknown>();
  const [connectionIssue, setConnectionIssue] = useState<unknown>();
  const [ordersReady, setOrdersReady] = useState(backendMode === "demo");
  const [ownerOrdersReady, setOwnerOrdersReady] = useState(backendMode === "demo");
  const [ownerOrders, setOwnerOrders] = useState<DemoOrder[]>([]);
  const [cartBusy, setCartBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [guideBusy, setGuideBusy] = useState(false);
  const [sessionWelcomeDismissed, setSessionWelcomeDismissed] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [reload, setReload] = useState(0);
  const guestCart = useRef<CartLine[]>([]);
  const authUser = useRef<User | null>(null);
  const generation = useRef(0);
  const accountSubscriptions = useRef<Unsubscribe[]>([]);
  const ownerSubscription = useRef<Unsubscribe | null>(null);
  const cartQueue = useRef<Promise<void>>(Promise.resolve());
  const onboardingQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingName = useRef("");
  const demoQuotes = useRef(new Map<string, { quote: CheckoutQuote; address: Address; uid: string; lines: CartLine[]; orderId?: string }>());
  const completedCartClears = useRef(new Set<string>());
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = state.user?.uid;
  const t = useCallback((en: string, te: string) => stateRef.current.language === "te" ? te : en, []);
  const explainError = useCallback((reason: unknown) => errorMessage(reason, t), [t]);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const commit = useCallback((change: (current: PreviewState) => PreviewState) => {
    const next = change(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);
  const markAccountReady = useCallback((value: boolean) => { accountReadyRef.current = value; setAccountReady(value); }, []);
  const sameAccount = useCallback((id: string, scope: number) => authUser.current?.uid === id && generation.current === scope, []);
  const requireOnline = useCallback(() => { if (!navigator.onLine) throw new StoreError("OFFLINE"); }, []);
  const assertAccount = useCallback((owner = false) => {
    const user = stateRef.current.user;
    if (!user) throw new StoreError("AUTH_REQUIRED");
    if (backendMode !== "demo" && (!authUser.current || authUser.current.uid !== user.uid)) throw new StoreError("ACCOUNT_CHANGED");
    if (!accountReadyRef.current) throw new StoreError("ACCOUNT_LOADING");
    if (backendMode !== "demo" && owner && !user.admin) throw new StoreError("ADMIN_REQUIRED");
    return { user, scope: generation.current };
  }, []);
  const persistGuest = useCallback(() => {
    try { localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ cart: guestCart.current, language: stateRef.current.language })); } catch { /* An in-memory guest cart remains usable when storage is blocked. */ }
  }, []);
  const queueCart = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const operation = cartQueue.current.then(task, task);
    cartQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);
  const stopAccount = useCallback(() => {
    accountSubscriptions.current.forEach(unsubscribe => unsubscribe());
    accountSubscriptions.current = [];
  }, []);
  const applyOnboarding = useCallback((id: string, progress: Onboarding) => {
    commit(current => ({ ...current,
      welcomeSeen: progress.welcomeSeen ? [...new Set([...current.welcomeSeen, id])] : current.welcomeSeen.filter(key => key !== id),
      dismissedTips: { ...current.dismissedTips, [id]: progress.skipped ? ["__skipped__"] : progress.dismissedPages },
    }));
  }, [commit]);

  const loadAccount = useCallback(async (user: User, scope: number) => {
    stopAccount();
    markAccountReady(false);
    setAccountIssue(undefined);
    setOrdersIssue(undefined);
    setOrdersReady(privateDraft);
    const { db } = getFirebaseServices();
    const profileRef = ref(db, `users/${user.uid}/profile`);
    const addressRef = ref(db, `users/${user.uid}/addresses/default`);
    const onboardingRef = ref(db, `users/${user.uid}/onboarding/web-v1`);
    const cartRef = ref(db, `carts/${user.uid}`);
    const guest = guestCart.current.map(line => ({ ...line }));
    try {
      requireOnline();
      const [profileSnapshot, addressSnapshot, onboardingSnapshot, lines] = await deadline(Promise.all([
        getServerValue(profileRef), getServerValue(addressRef), getServerValue(onboardingRef),
        queueCart(async () => {
          if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
          if (!guest.length) return parseCart((await getServerValue(cartRef)).val() ?? undefined);
          await waitDatabaseConnection();
          const result = await runTransaction(cartRef, raw => {
            if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
            return { lines: mergeGuestCart(parseCart(raw ?? undefined), guest), updatedAt: serverTimestamp() };
          }, { applyLocally: false });
          if (!result.committed) throw new StoreError("unavailable");
          return parseCart(result.snapshot.val() ?? undefined);
        }),
      ]));
      if (!sameAccount(user.uid, scope)) return;
      const profile = profileSnapshot.val();
      const email = user.email ?? "";
      if (!email) throw new StoreError("AUTH_REQUIRED");
      const phoneNumber = typeof profile?.phoneNumber === "string" ? profile.phoneNumber : "";
      let displayName = pendingName.current || user.displayName || t("Customer", "వినియోగదారు");
      let language: Language = stateRef.current.language;
      if (profile) {
        if (typeof profile.displayName !== "string" || profile.displayName.length < 2 || profile.email !== email || !["en", "te"].includes(profile.language)) throw new StoreError("INVALID_DATA");
        displayName = profile.displayName;
        language = profile.language;
      } else {
        await deadline(set(profileRef, { displayName, email, language }));
      }
      if (!sameAccount(user.uid, scope)) return;
      const address = addressSnapshot.exists() ? validateAddress(addressSnapshot.val() as Address) : undefined;
      const progress = parseOnboarding(onboardingSnapshot.val() ?? undefined);
      commit(current => ({ ...current, language,
        user: current.user?.uid === user.uid ? { ...current.user, name: displayName, phone: phoneNumber.replace(/^\+91/, ""), email } : current.user,
        cart: lines, addresses: address ? { [user.uid]: address } : {},
      }));
      // Clear the anonymous cart only after the server has acknowledged its merge.
      if (JSON.stringify(guestCart.current) === JSON.stringify(guest)) { guestCart.current = []; persistGuest(); }
      applyOnboarding(user.uid, progress);
      if (privateDraft) {
        try { setDemoReceipts(readDemoReceipts(localStorage.getItem(demoReceiptKey(user.uid)), user.uid)); }
        catch { setDemoReceipts([]); }
      }
      markAccountReady(true);
      pendingName.current = "";

      const accountFailure = (reason: unknown) => { if (sameAccount(user.uid, scope)) setAccountIssue(reason); };
      function watch<T>(reference: typeof profileRef, parse: (data: Record<string, unknown> | undefined) => T, receive: (value: T) => void) {
        return onValue(reference, snapshot => {
          if (!sameAccount(user.uid, scope)) return;
          try { receive(parse(snapshot.val() ?? undefined)); } catch (reason) { accountFailure(reason); }
        }, accountFailure);
      }
      accountSubscriptions.current = [
        watch(profileRef, data => {
          if (!data || typeof data.displayName !== "string" || data.displayName.length < 2 || data.email !== email || !["en", "te"].includes(data.language as string)) throw new StoreError("INVALID_DATA");
          return { name: data.displayName, language: data.language as Language };
        }, profile => commit(current => ({ ...current, language: profile.language, user: current.user?.uid === user.uid ? { ...current.user, name: profile.name } : current.user }))),
        watch(addressRef, data => data ? validateAddress(data as Address) : undefined, address => commit(current => ({ ...current, addresses: address ? { [user.uid]: address } : {} }))),
        watch(onboardingRef, parseOnboarding, progress => applyOnboarding(user.uid, progress)),
        watch(cartRef, parseCart, lines => commit(current => ({ ...current, cart: lines }))),
        ...(!privateDraft ? [onValue(query(ref(db, `${commerceRoot}/ordersByUser/${user.uid}`), orderByChild("createdAt"), limitToLast(50)), snapshot => {
          if (!sameAccount(user.uid, scope)) return;
          try {
            const orders = databaseRecords(snapshot).map(entry => parseStoreOrder(entry.id, entry.data())).filter((order): order is DemoOrder => !!order).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
            if (orders.some(order => order.uid !== user.uid)) throw new StoreError("INVALID_DATA");
            commit(current => ({ ...current, orders }));
            setOrdersIssue(undefined); setOrdersReady(true);
          } catch (reason) { setOrdersIssue(reason); setOrdersReady(true); }
        }, reason => {
          if (sameAccount(user.uid, scope)) {
            const code = "code" in reason ? reason.code : undefined;
            setOrdersIssue(privateDraft && (code === "PERMISSION_DENIED" || code === "permission-denied") ? new StoreError("TESTER_REQUIRED") : reason);
            setOrdersReady(true);
          }
        })] : []),
      ];
    } catch (reason) {
      if (sameAccount(user.uid, scope)) { setAccountIssue(reason); setOrdersReady(true); }
    }
  }, [applyOnboarding, commit, markAccountReady, persistGuest, queueCart, requireOnline, sameAccount, stopAccount, t]);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const online = () => { setOffline(false); if (backendMode !== "demo" && !accountReadyRef.current && authUser.current) setReload(value => value + 1); };
    const offline = () => setOffline(true);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  useEffect(() => {
    if (backendMode === "demo") {
      try { commit(() => readPreview(localStorage.getItem(DEMO_STORAGE_KEY))); } catch { /* Demo stays usable in memory. */ }
      setReady(true); markAccountReady(true);
      return;
    }
    let active = true;
    setConnectionIssue(undefined); setCatalogueIssues({}); setCatalogueReady(false); setReady(false);
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const saved = JSON.parse(stored);
        guestCart.current = parseCart({ lines: saved.cart });
        commit(current => ({ ...current, language: saved.language === "te" ? "te" : "en", cart: guestCart.current }));
      }
    } catch { guestCart.current = []; }
    let subscriptions: Unsubscribe[] = [];
    try {
      const { auth, db } = getFirebaseServices();
      const arrived = new Set<string>();
      const mark = (part: string, issue?: unknown) => {
        if (!active) return;
        arrived.add(part);
        setCatalogueIssues(current => { const next = { ...current }; if (issue) next[part] = issue; else delete next[part]; return next; });
        if (arrived.size === 3) setCatalogueReady(true);
      };
      subscriptions = [
        onValue(ref(db, `${commerceRoot}/products/groundnut-oil`), snapshot => {
          if (!active) return;
          try {
            const product = assertCurrentStoreRecord(parseProduct(snapshot.val() ?? undefined));
            setProduct(product?.published ? product : null); mark("product");
          } catch (reason) { setProduct(null); mark("product", reason); }
        }, reason => { setProduct(null); mark("product", reason); }),
        onValue(ref(db, `${commerceRoot}/variants`), snapshot => {
          if (!active) return;
          try {
            const variants = databaseRecords(snapshot).map(entry => assertCurrentStoreRecord(parseVariant(entry.id, entry.data()))).sort((a, b) => PACK_IDS.indexOf(a.id) - PACK_IDS.indexOf(b.id));
            commit(current => ({ ...current, variants })); mark("variants");
          } catch (reason) { commit(current => ({ ...current, variants: [] })); mark("variants", reason); }
        }, reason => { commit(current => ({ ...current, variants: [] })); mark("variants", reason); }),
        onValue(ref(db, `${commerceRoot}/publicContent/storefront`), snapshot => {
          if (!active) return;
          try {
            const settings = assertCurrentStoreRecord(parseSettings(snapshot.val() ?? undefined));
            setSettings(settings); mark("settings");
          } catch (reason) { setSettings(null); mark("settings", reason); }
        }, reason => { setSettings(null); mark("settings", reason); }),
        onIdTokenChanged(auth, user => {
          if (!active) return;
          const switched = authUser.current?.uid !== user?.uid || !user;
          if (switched) {
            generation.current += 1; stopAccount(); ownerSubscription.current?.(); ownerSubscription.current = null;
            setDemoReceipts([]);
            authUser.current = user; markAccountReady(!user); setAccountIssue(undefined); setOrdersIssue(undefined); setOwnerIssue(undefined);
            setOrdersReady(!user); setOwnerOrdersReady(!user); setOwnerOrders([]);
            commit(current => ({ ...current, user: user ? { uid: user.uid, name: user.displayName ?? "", phone: "", email: user.email ?? "", admin: false } : null,
              cart: guestCart.current.map(line => ({ ...line })), orders: [], addresses: {}, welcomeSeen: [], dismissedTips: {},
            }));
          }
          setReady(true);
          if (!user) return;
          const scope = generation.current;
          void user.getIdTokenResult().then(token => {
            if (!active || !sameAccount(user.uid, scope)) return;
            const admin = token.claims.admin === true;
            commit(current => ({ ...current, user: current.user?.uid === user.uid ? { ...current.user, admin } : current.user }));
            ownerSubscription.current?.(); ownerSubscription.current = null; setOwnerOrders([]); setOwnerIssue(undefined); setOwnerOrdersReady(!admin);
            if (admin) ownerSubscription.current = onValue(query(ref(db, `${commerceRoot}/orderIndex`), orderByChild("createdAt"), limitToLast(100)), snapshot => {
              if (!sameAccount(user.uid, scope)) return;
              try { setOwnerOrders(databaseRecords(snapshot).map(entry => parseStoreOrder(entry.id, entry.data())).filter((order): order is DemoOrder => !!order).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))); setOwnerOrdersReady(true); setOwnerIssue(undefined); }
              catch (reason) { setOwnerIssue(reason); setOwnerOrdersReady(true); }
            }, reason => { if (sameAccount(user.uid, scope)) { setOwnerIssue(reason); setOwnerOrdersReady(true); } });
            if (switched || !accountReadyRef.current) void loadAccount(user, scope);
          }).catch(reason => { if (sameAccount(user.uid, scope)) setAccountIssue(reason); });
        }, reason => { if (active) { setConnectionIssue(reason); setReady(true); } }),
      ];
      // A restarted subscription must hydrate even if Auth retained the UID.
      authUser.current = null;
    } catch (reason) { setConnectionIssue(reason); setReady(true); setCatalogueReady(true); }
    return () => {
      active = false; generation.current += 1; subscriptions.forEach(unsubscribe => unsubscribe()); stopAccount();
      ownerSubscription.current?.(); ownerSubscription.current = null;
    };
  }, [reload, commit, loadAccount, markAccountReady, sameAccount, stopAccount]);

  useEffect(() => {
    if (!ready) return;
    if (backendMode === "demo") {
      try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); } catch { /* Demo stays usable in memory. */ }
    } else persistGuest();
    document.documentElement.lang = state.language;
    document.body.dataset.language = state.language;
  }, [ready, state, persistGuest]);
  useEffect(() => {
    if (!privateDraft || !uid) return;
    const refresh = (event: StorageEvent) => {
      if (event.key === demoReceiptKey(uid)) setDemoReceipts(readDemoReceipts(event.newValue, uid));
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [uid]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 7500 : 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function mutateCart(change: (lines: CartLine[]) => CartLine[]): Promise<void> {
    if (placingRef.current) throw new StoreError("CHECKOUT_BUSY");
    const current = stateRef.current;
    if (!current.user || backendMode === "demo") {
      const lines = change(current.cart);
      commit(current => ({ ...current, cart: lines }));
      if (backendMode !== "demo") { guestCart.current = lines; persistGuest(); }
      return;
    }
    const { user, scope } = assertAccount();
    const before = current.cart.map(line => ({ ...line }));
    const intended = change(before);
    requireOnline(); setCartBusy(true);
    try {
      const lines = await deadline(queueCart(async () => {
        if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
        const { db } = getFirebaseServices();
        await waitDatabaseConnection();
        const result = await runTransaction(ref(db, `carts/${user.uid}`), raw => {
          if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
          return { lines: mergeCartEdit(parseCart(raw ?? undefined), before, intended), updatedAt: serverTimestamp() };
        }, { applyLocally: false });
        if (!result.committed) throw new StoreError("unavailable");
        return parseCart(result.snapshot.val() ?? undefined);
      }));
      if (sameAccount(user.uid, scope)) commit(current => ({ ...current, cart: lines }));
    } finally { setCartBusy(false); }
  }

  async function persistOnboarding(change: (progress: Onboarding) => Onboarding): Promise<void> {
    const { user, scope } = assertAccount();
    const read = () => ({ welcomeSeen: stateRef.current.welcomeSeen.includes(user.uid), skipped: (stateRef.current.dismissedTips[user.uid] ?? []).includes("__skipped__"), dismissedPages: (stateRef.current.dismissedTips[user.uid] ?? []).filter(page => page !== "__skipped__") });
    if (backendMode === "demo") { applyOnboarding(user.uid, change(read())); return; }
    requireOnline(); setGuideBusy(true);
    const operation = onboardingQueue.current.then(async () => {
      if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
      const { db } = getFirebaseServices();
      await waitDatabaseConnection();
      const result = await runTransaction(ref(db, `users/${user.uid}/onboarding/web-v1`), raw => {
        if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
        return change(parseOnboarding(raw ?? undefined));
      }, { applyLocally: false });
      if (!result.committed) throw new StoreError("unavailable");
      const progress = parseOnboarding(result.snapshot.val() ?? undefined);
      if (sameAccount(user.uid, scope)) applyOnboarding(user.uid, progress);
    });
    onboardingQueue.current = operation.catch(() => undefined);
    try { await deadline(operation); } finally { setGuideBusy(false); }
  }

  async function markWelcome(skipped: boolean) {
    const requestingUid = stateRef.current.user?.uid;
    try { await persistOnboarding(progress => ({ ...progress, welcomeSeen: true, skipped })); }
    catch (reason) {
      if (stateRef.current.user?.uid === requestingUid) setSessionWelcomeDismissed(requestingUid ?? null);
      notify(t("Guide progress was not saved. Continue browsing and replay the guide from your account when connected.", "గైడ్ సేవ్ కాలేదు. బ్రౌజింగ్ కొనసాగించి, కనెక్ట్ అయిన తరువాత ఖాతా నుంచి గైడ్ మళ్లీ చూడండి.") + " " + explainError(reason), true);
    }
  }
  const showWelcome = ready && accountReady && !!uid && sessionWelcomeDismissed !== uid && !state.welcomeSeen.includes(uid) && !["/checkout", "/sign-in"].includes(pathname) && !pathname.startsWith("/admin");
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (showWelcome && !element.open) element.showModal();
    if (!showWelcome && element.open) element.close();
  }, [showWelcome]);
  const watchOrder = useCallback((id: string, receive: (order: DemoOrder | null) => void, fail: (reason: unknown) => void, owner = false): Unsubscribe => {
    if (backendMode === "demo") { receive(stateRef.current.orders.find(order => order.id === id) ?? null); return () => undefined; }
    const user = authUser.current;
    const scope = generation.current;
    if (!user) { receive(null); return () => undefined; }
    if (owner && !stateRef.current.user?.admin) throw new StoreError("ADMIN_REQUIRED");
    const path = owner ? `${commerceRoot}/orderIndex/${id}` : `${commerceRoot}/ordersByUser/${user.uid}/${id}`;
    return onValue(ref(getFirebaseServices().db, path), snapshot => {
      if (!sameAccount(user.uid, scope)) return;
      try { receive(parseStoreOrder(snapshot.key ?? id, snapshot.val() ?? undefined)); } catch (reason) { fail(reason); }
    }, reason => { if (sameAccount(user.uid, scope)) fail(reason); });
  }, [sameAccount]);

  const value: Context = {
    state, mode: backendMode, ready, accountReady, catalogueReady, ordersReady, ownerOrdersReady,
    demoReceipts: demoReceipts.filter(receipt => receipt.uid === uid),
    ownerOrders: backendMode === "demo" ? state.orders : ownerOrders,
    catalogueAvailable: !!product && state.variants.length > 0 && Object.keys(catalogueIssues).length === 0,
    cartBusy: cartBusy || placing, guideBusy, offline, product, settings, t, explainError, notify, watchOrder,
    catalogueError: Object.values(catalogueIssues).length ? explainError(Object.values(catalogueIssues)[0]) : "",
    accountError: accountIssue ? explainError(accountIssue) : "", ordersError: ordersIssue ? explainError(ordersIssue) : "",
    ownerError: ownerIssue ? explainError(ownerIssue) : "", connectionError: connectionIssue ? explainError(connectionIssue) : "",
    retryConnection: () => setReload(current => current + 1),
    toggleLanguage: async () => {
      const previous = stateRef.current.language;
      const language: Language = previous === "en" ? "te" : "en";
      try {
        if (backendMode !== "demo" && stateRef.current.user) {
          const { user, scope } = assertAccount(); requireOnline();
          await deadline(set(ref(getFirebaseServices().db, `users/${user.uid}/profile`), { displayName: user.name, email: user.email, language }));
          if (!sameAccount(user.uid, scope)) return;
        }
        commit(current => ({ ...current, language }));
      } catch (reason) { notify(explainError(reason), true); }
    },
    addPack: async (id, quantity = 1) => {
      try {
        if (!ready || !catalogueReady || !product) throw new StoreError("STORE_NOT_READY");
        await mutateCart(lines => {
          const variant = stateRef.current.variants.find(variant => variant.id === id);
          const count = (lines.find(line => line.id === id)?.quantity ?? 0) + quantity;
          if (!Number.isInteger(quantity) || quantity < 1 || count > cartQuantityLimit(variant, privateDraft)) throw new StoreError("OUT_OF_STOCK");
          return PACK_IDS.flatMap(pack => pack === id ? [{ id, quantity: count }] : lines.filter(line => line.id === pack));
        });
        notify(t("Added to your cart", "కార్ట్‌లో చేర్చబడింది")); return true;
      } catch (reason) { notify(explainError(reason), true); return false; }
    },
    setQuantity: async (id, quantity) => {
      try {
        await mutateCart(lines => {
          const existing = lines.find(line => line.id === id)?.quantity ?? 0;
          const variant = stateRef.current.variants.find(variant => variant.id === id);
          if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20 || (quantity >= existing && quantity > 0 && quantity > cartQuantityLimit(variant, privateDraft))) throw new StoreError("OUT_OF_STOCK");
          return quantity === 0 ? lines.filter(line => line.id !== id) : lines.map(line => line.id === id ? { id, quantity } : line);
        });
      } catch (reason) { notify(explainError(reason), true); }
    },
    login: async ({ email: input, password, name = "", createAccount = false }) => {
      const email = input.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 128 ||
          (createAccount && (name.trim().length < 2 || name.trim().length > 100 || password.length < 8))) throw new StoreError("INVALID_INPUT");
      if (backendMode === "demo") {
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
        const uid = "demo_" + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
        const displayName = name.trim() || (stateRef.current.user?.uid === uid ? stateRef.current.user.name : t("Customer", "వినియోగదారు"));
        commit(current => ({ ...current, user: { uid, name: displayName, email, phone: "", admin: false }, cart: current.user && current.user.uid !== uid ? [] : current.cart }));
        return;
      }
      requireOnline(); pendingName.current = createAccount ? name.trim() : "";
      const { auth } = getFirebaseServices();
      const result = await deadline(createAccount ? createUserWithEmailAndPassword(auth, email, password) : signInWithEmailAndPassword(auth, email, password));
      if (createAccount) await deadline(updateProfile(result.user, { displayName: name.trim() }));
    },
    resetPassword: async email => {
      if (backendMode === "demo") throw new StoreError("CONFIG_REQUIRED");
      requireOnline();
      try { await deadline(sendPasswordResetEmail(getFirebaseServices().auth, email.trim().toLowerCase())); }
      catch (reason) {
        if (!(typeof reason === "object" && reason && "code" in reason && reason.code === "auth/user-not-found")) throw reason;
      }
    },
    logout: async () => {
      if (placingRef.current) throw new StoreError("CHECKOUT_BUSY");
      if (backendMode === "demo") { commit(current => ({ ...current, user: null, cart: [] })); return; }
      await signOut(getFirebaseServices().auth);
    },
    dismissTip: async page => {
      try { await persistOnboarding(progress => ({ ...progress, dismissedPages: [...new Set([...progress.dismissedPages, guidePageKey(page)])].slice(-20) })); }
      catch (reason) { notify(explainError(reason), true); }
    },
    skipGuide: async () => {
      try { await persistOnboarding(progress => ({ ...progress, welcomeSeen: true, skipped: true })); }
      catch (reason) { notify(explainError(reason), true); }
    },
    replayGuide: async () => {
      try { await persistOnboarding(() => ({ ...EMPTY_ONBOARDING, dismissedPages: [] })); setSessionWelcomeDismissed(null); }
      catch (reason) { notify(explainError(reason), true); }
    },
    saveAddress: async address => {
      const { user, scope } = assertAccount();
      const valid = validateAddress(address);
      if (backendMode !== "demo") {
        requireOnline(); await deadline(set(ref(getFirebaseServices().db, `users/${user.uid}/addresses/default`), valid));
        if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
      }
      commit(current => ({ ...current, addresses: { ...current.addresses, [user.uid]: valid } }));
      notify(backendMode === "demo" ? t("Sample address saved", "నమూనా చిరునామా సేవ్ చేయబడింది") : t("Address saved", "చిరునామా సేవ్ చేయబడింది"));
    },
    quoteDemoCheckout: async address => {
      if (!privateDraft || backendMode !== 'firebase' || !product || !catalogueReady) throw new StoreError('STORE_NOT_READY');
      const { user, scope } = assertAccount();
      requireOnline();
      const lines = await deadline(queueCart(async () => parseCart((await getServerValue(ref(getFirebaseServices().db, `carts/${user.uid}`))).val())));
      if (!sameAccount(user.uid, scope)) throw new StoreError('ACCOUNT_CHANGED');
      return makeDemoBill(user.uid, address, lines, stateRef.current.variants, crypto.randomUUID());
    },
    confirmDemoPayment: async bill => {
      if (!privateDraft || backendMode !== 'firebase' || !product) throw new StoreError('STORE_NOT_READY');
      if (placingRef.current) throw new StoreError('CHECKOUT_BUSY');
      const { user, scope } = assertAccount();
      if (bill.uid !== user.uid) throw new StoreError('ACCOUNT_CHANGED');
      placingRef.current = true; setPlacing(true);
      try {
        let existing: LocalDemoReceipt | undefined;
        try { existing = readDemoReceipts(localStorage.getItem(demoReceiptKey(user.uid)), user.uid).find(receipt => receipt.id === `NN-DEMO-${bill.quoteId}`); }
        catch { throw new StoreError('LOCAL_STORAGE'); }
        if (!existing) {
          requireOnline();
          const lines = await deadline(queueCart(async () => parseCart((await getServerValue(ref(getFirebaseServices().db, `carts/${user.uid}`))).val())));
          if (!sameAccount(user.uid, scope)) throw new StoreError('ACCOUNT_CHANGED');
          assertDemoBillCurrent(bill, user.uid, lines, stateRef.current.variants);
        }
        const saved = persistDemoReceipt(localStorage, bill, user.uid);
        if (!sameAccount(user.uid, scope)) throw new StoreError('ACCOUNT_CHANGED');
        setDemoReceipts(readDemoReceipts(localStorage.getItem(demoReceiptKey(user.uid)), user.uid));
        if (saved.created) {
          try {
            const remaining = await deadline(queueCart(async () => {
              if (!sameAccount(user.uid, scope)) throw new StoreError('ACCOUNT_CHANGED');
              await waitDatabaseConnection();
              const result = await runTransaction(ref(getFirebaseServices().db, `carts/${user.uid}`), raw => {
                if (!sameAccount(user.uid, scope)) throw new StoreError('ACCOUNT_CHANGED');
                return { lines: removePurchasedLines(parseCart(raw), bill.lines), updatedAt: serverTimestamp() };
              }, { applyLocally: false });
              if (!result.committed) throw new StoreError('unavailable');
              return parseCart(result.snapshot.val());
            }));
            if (sameAccount(user.uid, scope)) commit(current => ({ ...current, cart: remaining }));
          } catch {
            if (sameAccount(user.uid, scope)) notify(t('Demo receipt saved. Your cart could not synchronize; review it before another demo.', 'డెమో రసీదు సేవ్ అయింది. కార్ట్ సేవ్ కాలేదు; మరో డెమో ముందు సరిచూడండి.'), true);
          }
        }
        if (!sameAccount(user.uid, scope)) throw new StoreError('ACCOUNT_CHANGED');
        return saved.receipt.id;
      } finally { placingRef.current = false; setPlacing(false); }
    },
    updateVariant: async variant => {
      if (backendMode !== "demo") assertAccount(true);
      if (!Number.isInteger(variant.pricePaise) || variant.pricePaise < 100 || variant.pricePaise > 1_000_000 || !Number.isInteger(variant.stock) || variant.stock < 0 || variant.stock > 100_000) throw new StoreError("INVALID_INPUT");
      if (backendMode === "demo") commit(current => ({ ...current, variants: current.variants.map(entry => entry.id === variant.id ? { ...variant, preview: true } : entry) }));
      else {
        requireOnline();
        await commerceApi("updateVariant", { id: variant.id, pricePaise: variant.pricePaise, stock: variant.stock, enabled: variant.enabled });
      }
      notify(backendMode === "demo" ? t("Sample catalogue updated", "నమూనా కేటలాగ్ మార్చబడింది") : t("Catalogue updated", "కేటలాగ్ మార్చబడింది"));
    },
    updateOrder: async (id, status) => {
      if (backendMode !== "demo") assertAccount(true);
      if (backendMode !== "demo") {
        requireOnline(); await commerceApi("updateOrderStatus", { orderId: id, status });
      } else {
        const order = stateRef.current.orders.find(order => order.id === id);
        if (!order) throw new StoreError("ORDER_NOT_FOUND");
        const next: Record<DemoOrder["status"], DemoOrder["status"][]> = { received: ["packed", "cancelled"], packed: ["shipped", "cancelled"], shipped: ["delivered"], delivered: [], cancelled: [] };
        if (status !== order.status && !next[order.status].includes(status)) throw new StoreError("INVALID_TRANSITION");
        commit(current => ({ ...current, orders: current.orders.map(entry => entry.id === id ? { ...entry, status, paymentStatus: status === "delivered" ? "collected" : status === "cancelled" ? "cancelled" : entry.paymentStatus } : entry),
          variants: status === "cancelled" && order.status !== "cancelled" ? current.variants.map(variant => ({ ...variant, stock: variant.stock + (order.lines.find(line => line.id === variant.id)?.quantity ?? 0) })) : current.variants,
        }));
      }
      notify(t("Order status updated", "ఆర్డర్ స్థితి మార్చబడింది"));
    },
    checkDelivery: async (pin, lines) => {
      if (!/^[1-9]\d{5}$/.test(pin)) throw new StoreError("INVALID_INPUT");
      if (backendMode === "demo") {
        const quote = deliveryQuote(pin, lines, stateRef.current.variants);
        if (!quote) throw new StoreError("NOT_SERVICEABLE");
        return { ...quote, preview: true };
      }
      requireOnline();
      let data: Record<string, unknown> | undefined;
      try { data = (await deadline(getServerValue(ref(getFirebaseServices().db, `${commerceRoot}/deliveryRules/${pin}`)))).val() ?? undefined; }
      catch (reason) {
        if (typeof reason === "object" && reason && "code" in reason && reason.code === "permission-denied") throw new StoreError("NOT_SERVICEABLE");
        throw reason;
      }
      if (!data || data.enabled !== true) throw new StoreError("NOT_SERVICEABLE");
      assertCurrentStoreRecord(data);
      const surcharge = data.extraLitrePaise ?? 0;
      const included = data.includedLitres ?? 0;
      if (typeof data.feePaise !== "number" || !Number.isInteger(data.feePaise) || data.feePaise < 0 || typeof surcharge !== "number" || !Number.isInteger(surcharge) || surcharge < 0 || typeof included !== "number" || !Number.isInteger(included) || included < 0 || typeof data.local !== "boolean" || typeof data.codAllowed !== "boolean" || typeof data.estimate !== "string") throw new StoreError("INVALID_DATA");
      const litres = lines.reduce((sum, line) => sum + (stateRef.current.variants.find(variant => variant.id === line.id)?.litres ?? 0) * line.quantity, 0);
      return { local: data.local, feePaise: data.feePaise + Math.max(0, litres - included) * surcharge, estimate: data.estimate, codAllowed: data.codAllowed, preview: backendMode === "emulator" || privateDraft || data.preview === true };
    },
    quoteCheckout: async address => {
      if (privateDraft) throw new StoreError("STORE_NOT_READY");
      const { user, scope } = assertAccount();
      const valid = validateAddress(address);
      const current = stateRef.current;
      if (!current.cart.length) throw new StoreError("INVALID_INPUT");
      if (!product || !settings?.orderingEnabled) throw new StoreError("STORE_NOT_READY");
      if (backendMode !== "demo") {
        requireOnline();
        const result = await commerceApi("quoteCheckout", { lines: current.cart.map(({ id, quantity }) => ({ id, quantity })), address: valid, channel: "web" });
        if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
        return assertCurrentStoreRecord(parseQuote(result.data));
      }
      const delivery = deliveryQuote(valid.pin, current.cart, current.variants);
      if (!delivery) throw new StoreError("NOT_SERVICEABLE");
      const lines = current.cart.map(line => {
        const variant = current.variants.find(variant => variant.id === line.id);
        if (!variant?.enabled || line.quantity > variant.stock) throw new StoreError("OUT_OF_STOCK");
        return { ...line, litres: variant.litres, unitPricePaise: variant.pricePaise };
      });
      const subtotalPaise = cartSubtotal(current.cart, current.variants);
      const quote: CheckoutQuote = { quoteId: "demo_quote_" + crypto.randomUUID(), subtotalPaise, shippingPaise: delivery.feePaise, totalPaise: subtotalPaise + delivery.feePaise, codAllowed: delivery.codAllowed, estimate: delivery.estimate, expiresAt: new Date(Date.now() + 600_000).toISOString(), preview: true, lines };
      demoQuotes.current.set(quote.quoteId, { quote, address: valid, uid: user.uid, lines: current.cart.map(line => ({ ...line })) });
      return quote;
    },
    placeOrder: async (quote, idempotencyKey) => {
      if (privateDraft) throw new StoreError("STORE_NOT_READY");
      assertCurrentStoreRecord(quote);
      if (placingRef.current) throw new StoreError("CHECKOUT_BUSY");
      const { user, scope } = assertAccount();
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new StoreError("INVALID_INPUT");
      if (!quote.codAllowed) throw new StoreError("COD_UNAVAILABLE");
      placingRef.current = true; setPlacing(true);
      try {
        let id: string;
        if (backendMode === "demo") {
          const stored = demoQuotes.current.get(quote.quoteId);
          if (!stored) throw new StoreError("QUOTE_NOT_FOUND");
          if (stored.uid !== user.uid) throw new StoreError("QUOTE_OWNER_MISMATCH");
          if (stored.orderId) return stored.orderId;
          if (Date.parse(stored.quote.expiresAt) <= Date.now()) throw new StoreError("QUOTE_EXPIRED");
          if (JSON.stringify(stored.lines) !== JSON.stringify(stateRef.current.cart)) throw new StoreError("QUOTE_CHANGED");
          for (const line of quote.lines) {
            const variant = stateRef.current.variants.find(variant => variant.id === line.id);
            if (!variant?.enabled || variant.stock < line.quantity) throw new StoreError("OUT_OF_STOCK");
            if (variant.pricePaise !== line.unitPricePaise) throw new StoreError("QUOTE_CHANGED");
          }
          id = "NN-DEMO-" + Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 8);
          const order: DemoOrder = { id, uid: user.uid, customerPhone: "+91" + stored.address.phone, createdAt: new Date().toISOString(), lines: quote.lines, address: stored.address, subtotalPaise: quote.subtotalPaise, shippingPaise: quote.shippingPaise, totalPaise: quote.totalPaise, paymentMethod: "cod", paymentStatus: "pending_collection", status: "received", channel: "web", preview: true };
          stored.orderId = id;
          commit(current => ({ ...current, orders: [order, ...current.orders], cart: [], addresses: { ...current.addresses, [user.uid]: stored.address },
            variants: current.variants.map(variant => ({ ...variant, stock: variant.stock - (quote.lines.find(line => line.id === variant.id)?.quantity ?? 0) })),
          }));
        } else {
          requireOnline();
          const response = await commerceApi("placeCodOrder", { quoteId: quote.quoteId, idempotencyKey });
          const data = response.data as { orderId?: unknown };
          if (typeof data?.orderId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(data.orderId)) throw new StoreError("INVALID_DATA");
          id = data.orderId;
          if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
          const marker = "nn-order-cart-" + user.uid + "-" + id;
          let alreadyCleared = completedCartClears.current.has(marker);
          try { alreadyCleared ||= localStorage.getItem(marker) === "attempted"; } catch { /* In-memory retry protection still applies. */ }
          if (!alreadyCleared) {
            // Mark before clearing so a reload/retry cannot erase a later cart.
            completedCartClears.current.add(marker);
            try { localStorage.setItem(marker, "attempted"); } catch { /* In-memory retry protection still applies. */ }
            try {
              const result = await deadline(queueCart(async () => {
                if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
                const { db } = getFirebaseServices();
                await waitDatabaseConnection();
                const purchased = quote.lines.map(({ id, quantity }) => ({ id, quantity }));
                let changed = false;
                const result = await runTransaction(ref(db, `carts/${user.uid}`), raw => {
                  if (!sameAccount(user.uid, scope)) throw new StoreError("ACCOUNT_CHANGED");
                  const cart = parseCart(raw ?? undefined);
                  changed = JSON.stringify(cart) !== JSON.stringify(purchased);
                  return { lines: removePurchasedLines(cart, purchased), updatedAt: serverTimestamp() };
                }, { applyLocally: false });
                if (!result.committed) throw new StoreError("unavailable");
                return { lines: parseCart(result.snapshot.val() ?? undefined), changed };
              }));
              if (sameAccount(user.uid, scope)) commit(current => ({ ...current, cart: result.lines }));
              if (result.changed) notify(t("Your order was saved. Your cart changed during checkout and has been kept for review.", "మీ ఆర్డర్ సేవ్ అయింది. చెక్అవుట్‌లో కార్ట్ మారింది; సరిచూడడానికి అలాగే ఉంచబడింది."));
              guestCart.current = []; persistGuest();
            } catch {
              notify(t("Your order was saved. The cart could not synchronize; review it before ordering again.", "మీ ఆర్డర్ సేవ్ అయింది. కార్ట్ సమకాలీకరణ కాలేదు; మళ్లీ ఆర్డర్ ముందు సరిచూడండి."), true);
            }
          }
        }
        return id;
      } finally { placingRef.current = false; setPlacing(false); }
    },
  };

  return <PreviewContext.Provider value={value}>
    {children}
    <div className={"toast " + (toast ? "visible" : "")} role={toast?.error ? "alert" : "status"} aria-live={toast?.error ? "assertive" : "polite"}>{toast && <>{toast.error ? <AlertCircle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}<span>{toast.message}</span></>}</div>
    <dialog className="welcome-dialog" ref={dialog} onCancel={event => { event.preventDefault(); void markWelcome(true); }} aria-labelledby="welcome-heading">
      <button className="icon-button dialog-close" disabled={guideBusy} aria-label={t("Skip guide", "గైడ్‌ను దాటవేయండి")} onClick={() => void markWelcome(true)}><X size={22} /></button>
      <div className="welcome-symbol"><BrandLogo variant="mark" decorative /></div>
      <h2 id="welcome-heading">{t("Welcome to Narayana Naturals", "నారాయణ నేచురల్స్‌కు స్వాగతం")}</h2>
      <p>{t("Choose your oil pack, check delivery to your PIN code, and follow your order here. A short guide will help you find your way around each page.", "నూనె ప్యాక్‌ను ఎంచుకోండి, మీ పిన్ కోడ్‌కు డెలివరీని చూడండి మరియు ఆర్డర్‌ను ట్రాక్ చేయండి. ప్రతి పేజీకి ఒక చిన్న గైడ్ మీకు సహాయం చేస్తుంది.")}</p>
      <div className="welcome-actions"><button className="button primary" disabled={guideBusy} onClick={() => void markWelcome(false)}>{guideBusy ? t("Saving…", "సేవ్ అవుతోంది…") : t("Start guide", "గైడ్ ప్రారంభించండి")}<ArrowRight size={18} /></button><button className="button quiet" disabled={guideBusy} onClick={() => void markWelcome(true)}>{t("Skip for now", "ఇప్పటికి దాటవేయండి")}</button></div>
    </dialog>
  </PreviewContext.Provider>;
}
