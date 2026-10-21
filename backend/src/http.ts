import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Auth } from 'firebase-admin/auth';
import type { AppCheck } from 'firebase-admin/app-check';
import { ApiError, exactKeys, fail } from './model.js';
import type { Actor } from './model.js';
import type { CommerceService } from './commerce.js';

export interface StoreHealth {
  configured: boolean; orderingEnabled: boolean; onlinePaymentsEnabled: boolean;
}
interface Dependencies {
  service: CommerceService; auth: Auth; appCheck?: AppCheck; isEmulator: boolean; origins: string[];
  projectId: string; health: () => Promise<StoreHealth>;
}
function send(response: ServerResponse, status: number, data: unknown) {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  response.end(JSON.stringify(data));
}
function failure(response: ServerResponse, error: unknown) {
  const known = error instanceof ApiError ? error : new ApiError('UNAVAILABLE', 'The store could not complete this request. Retry the same request.');
  send(response, known.status, { error: { code: known.code, message: known.message, details: { nativeCode: known.nativeCode } } });
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    fail('INVALID_INPUT', 'Send JSON data.', 'invalid-argument');
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 32 * 1024) fail('INVALID_INPUT', 'The request is too large.', 'invalid-argument');
    chunks.push(buffer);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('INVALID_INPUT', 'Send a valid JSON object.', 'invalid-argument'); }
  return exactKeys(body, ['data']).data;
}
export function createCommerceServer(deps: Dependencies) {
  const methods = {
    quoteCheckout: (actor: Actor, data: unknown) => deps.service.quoteCheckout(actor, data),
    placeCodOrder: (actor: Actor, data: unknown) => deps.service.placeCodOrder(actor, data),
    updateVariant: (actor: Actor, data: unknown) => deps.service.updateVariant(actor, data),
    updateOrderStatus: (actor: Actor, data: unknown) => deps.service.updateOrderStatus(actor, data),
  };
  const server = createServer(async (request, response) => {
    const timer = setTimeout(() => failure(response, new ApiError('UNAVAILABLE', 'The response took too long. Retry the same order.')), 30_000);
    timer.unref();
    try {
      const origin = request.headers.origin;
      if (origin && !deps.origins.includes(origin)) fail('ORIGIN_NOT_ALLOWED', 'This website is not allowed to call the API.', 'permission-denied');
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Firebase-AppCheck', 'Access-Control-Max-Age': '600' });
        response.end();
        return;
      }
      if (request.method === 'GET' && request.url === '/health') {
        let health: StoreHealth = { configured: false, orderingEnabled: false, onlinePaymentsEnabled: false };
        try { health = await Promise.race([deps.health(), new Promise<StoreHealth>(resolve => {
          const t = setTimeout(() => resolve({ configured: false, orderingEnabled: false, onlinePaymentsEnabled: false }), 2500); t.unref();
        })]); }
        catch { /* Keep the unavailable response and avoid exposing database errors. */ }
        send(response, health.configured ? 200 : 503, { status: health.configured ? 'ok' : 'store_not_configured',
          mode: deps.isEmulator ? 'emulator' : 'firebase', stage: deps.service.stage, projectId: deps.projectId,
          database: 'realtime', authentication: 'email_password',
          checkout: health.configured && health.orderingEnabled ? 'cod' : 'disabled',
          onlinePaymentsEnabled: health.configured && health.onlinePaymentsEnabled });
        return;
      }
      const method = request.url?.match(/^\/v1\/(quoteCheckout|placeCodOrder|updateVariant|updateOrderStatus)$/)?.[1] as keyof typeof methods | undefined;
      if (request.method !== 'POST' || !method) {
        send(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
        return;
      }
      const bearer = request.headers.authorization;
      if (!bearer || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(bearer)) fail('AUTH_REQUIRED', 'Sign in before continuing.', 'unauthenticated');
      let actor: Actor;
      try {
        const decoded = await deps.auth.verifyIdToken(bearer.slice(7), true);
        actor = { uid: decoded.uid, token: decoded as unknown as Record<string, unknown> };
      } catch { fail('AUTH_REQUIRED', 'Your sign-in could not be verified. Sign in again.', 'unauthenticated'); }
      if (!deps.isEmulator) {
        const token = request.headers['x-firebase-appcheck'];
        if (typeof token !== 'string' || !deps.appCheck) fail('APP_CHECK_REQUIRED', 'App verification is required.', 'unauthenticated');
        try { await deps.appCheck.verifyToken(token); }
        catch { fail('APP_CHECK_REQUIRED', 'App verification failed. Refresh and try again.', 'unauthenticated'); }
      }
      const data = await readBody(request);
      send(response, 200, { data: await methods[method](actor, data) });
    } catch (error) { failure(response, error); }
    finally { clearTimeout(timer); }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 100;
  return server;
}
