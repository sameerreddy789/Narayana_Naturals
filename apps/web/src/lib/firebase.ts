import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectDatabaseEmulator, get, getDatabase, onValue, ref, type Database, type DatabaseReference, type DataSnapshot } from "firebase/database";
import { StoreError } from "./commerce";

export type BackendMode = "demo" | "emulator" | "firebase";
const configuredMode = process.env.NEXT_PUBLIC_BACKEND_MODE ?? "demo";
export const backendMode: BackendMode = configuredMode === "demo" || configuredMode === "emulator" ? configuredMode : "firebase";
export const EMULATOR_PROJECT_ID = "demo-narayana-naturals";
type Services = { app: FirebaseApp; auth: Auth; db: Database; appCheck?: AppCheck };
let services: Services | undefined;

// Initialization happens only in a browser effect/event. The emulator project
// and database namespace are selected before any SDK can open a connection.
export function getFirebaseServices(): Services {
  if (typeof window === "undefined" || backendMode === "demo" || !["demo", "emulator", "firebase"].includes(configuredMode)) throw new StoreError("CONFIG_REQUIRED");
  if (services) return services;
  const emulator = backendMode === "emulator";
  const apiKey = emulator ? "demo-api-key" : process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = emulator ? EMULATOR_PROJECT_ID : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = emulator ? "1:000000000000:web:narayana-emulator" : process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const authDomain = emulator ? "localhost" : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const databaseURL = emulator
    ? "https://demo-narayana-naturals-default-rtdb.firebaseio.com"
    : process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  if (!apiKey || !projectId || !appId || !authDomain || !databaseURL || (!emulator && projectId.startsWith("demo-"))) throw new StoreError("CONFIG_REQUIRED");
  const name = `narayana-naturals-rtdb-${backendMode}`;
  const app = getApps().find(value => value.name === name) ?? initializeApp({
    apiKey, projectId, appId, authDomain, databaseURL,
    storageBucket: emulator ? `${EMULATOR_PROJECT_ID}.appspot.com` : process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: emulator ? "000000000000" : process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  }, name);
  const auth = getAuth(app);
  const db = getDatabase(app, databaseURL);
  let appCheck: AppCheck | undefined;
  if (emulator) {
    const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST ?? "127.0.0.1";
    if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new StoreError("CONFIG_REQUIRED");
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(db, host, 9000);
  } else {
    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
    if (siteKey) {
      if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG === "true") {
        (window as Window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      appCheck = initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
    }
  }
  services = { app, auth, db, appCheck };
  return services;
}

// RTDB get() may fall back to a local cache when disconnected. Account
// hydration and transactions wait for a real connection instead.
export function waitDatabaseConnection(milliseconds = 15_000): Promise<void> {
  if (!navigator.onLine) return Promise.reject(new StoreError("OFFLINE"));
  const { db } = getFirebaseServices();
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;
    const timer = setTimeout(() => { unsubscribe?.(); reject(new StoreError("unavailable")); }, milliseconds);
    unsubscribe = onValue(ref(db, ".info/connected"), snapshot => {
      if (snapshot.val() === true) { settled = true; clearTimeout(timer); unsubscribe?.(); resolve(); }
    }, reason => { settled = true; clearTimeout(timer); unsubscribe?.(); reject(reason); });
    if (settled) unsubscribe();
  });
}
export async function getServerValue(reference: DatabaseReference): Promise<DataSnapshot> {
  await waitDatabaseConnection();
  const value = await get(reference);
  // .info is local connection metadata. RTDB get() sends a server query and
  // must not be used for this reserved path.
  const connected = await new Promise<boolean>((resolve, reject) => {
    onValue(ref(getFirebaseServices().db, ".info/connected"), snapshot => resolve(snapshot.val() === true), reject, { onlyOnce: true });
  });
  if (!connected) throw new StoreError("OFFLINE");
  return value;
}
export function databaseRecords(snapshot: DataSnapshot): { id: string; data: () => Record<string, unknown> }[] {
  const result: { id: string; data: () => Record<string, unknown> }[] = [];
  snapshot.forEach(child => { result.push({ id: child.key!, data: () => child.val() }); });
  return result;
}

type CommerceMethod = "quoteCheckout" | "placeCodOrder" | "updateVariant" | "updateOrderStatus";
export async function commerceApi(method: CommerceMethod, data: unknown): Promise<{ data: unknown }> {
  if (!navigator.onLine) throw new StoreError("OFFLINE");
  const { auth, appCheck } = getFirebaseServices();
  const user = auth.currentUser;
  if (!user) throw new StoreError("AUTH_REQUIRED");
  const configured = process.env.NEXT_PUBLIC_COMMERCE_API_URL || (backendMode === "emulator" ? "http://127.0.0.1:5002" : "");
  let url: URL;
  try { url = new URL(configured); } catch { throw new StoreError("API_NOT_CONFIGURED"); }
  if (url.username || url.password || url.search || url.hash || (backendMode === "firebase" && url.protocol !== "https:") ||
      (backendMode === "emulator" && (url.protocol !== "http:" || !["127.0.0.1", "localhost", "10.0.2.2"].includes(url.hostname)))) throw new StoreError("API_NOT_CONFIGURED");
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` };
  if (appCheck) headers["X-Firebase-AppCheck"] = (await getToken(appCheck, false)).token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${url.href.replace(/\/$/, "")}/v1/${method}`, {
      method: "POST", headers, body: JSON.stringify({ data }), signal: controller.signal,
      cache: "no-store", credentials: "omit",
    });
    const body = await response.json();
    if (!response.ok || body?.error) throw new StoreError(typeof body?.error?.code === "string" ? body.error.code : "unavailable");
    if (!body || !Object.hasOwn(body, "data")) throw new StoreError("INVALID_DATA");
    return { data: body.data };
  } catch (reason) {
    if (reason instanceof StoreError) throw reason;
    if (reason instanceof DOMException && reason.name === "AbortError") throw new StoreError("deadline-exceeded");
    throw new StoreError("unavailable");
  } finally { clearTimeout(timer); }
}
