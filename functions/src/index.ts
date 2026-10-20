import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { CommerceService } from './commerce.js';
import type { Actor } from './model.js';

if (getApps().length === 0) initializeApp();
export const isEmulatorRuntime = process.env.FUNCTIONS_EMULATOR === 'true' && Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const service = new CommerceService(getFirestore(), { isEmulator: isEmulatorRuntime });
const options = { region: 'asia-south1', enforceAppCheck: !isEmulatorRuntime, maxInstances: 10,
  concurrency: 40, timeoutSeconds: 30, memory: '256MiB' as const };
function actor(request: CallableRequest): Actor | undefined {
  return request.auth ? { uid: request.auth.uid, token: request.auth.token } : undefined;
}
export const quoteCheckout = onCall(options, request => service.quoteCheckout(actor(request), request.data));
export const placeCodOrder = onCall(options, request => service.placeCodOrder(actor(request), request.data));
export const updateVariant = onCall(options, request => service.updateVariant(actor(request), request.data));
export const updateOrderStatus = onCall(options, request => service.updateOrderStatus(actor(request), request.data));
