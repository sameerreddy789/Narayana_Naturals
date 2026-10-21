export const DEMO_PROJECT = 'demo-narayana-naturals';
export const LIVE_PROJECT = 'narayananaturals-6b5aa';
export const DEMO_DATABASE_URL = 'https://demo-narayana-naturals-default-rtdb.firebaseio.com';
export const LIVE_DATABASE_URL = `https://${LIVE_PROJECT}-default-rtdb.firebaseio.com`;
export type StoreStage = 'private-draft' | 'production';
export function parseStoreStage(value: unknown = 'production'): StoreStage {
  if (value !== 'private-draft' && value !== 'production') throw new Error('STORE_STAGE must be private-draft or production.');
  return value;
}
export function commerceRoot(stage: StoreStage): 'commerceDraft' | 'commerce' {
  return stage === 'private-draft' ? 'commerceDraft' : 'commerce';
}
export function hasEmulatorHosts(env: NodeJS.ProcessEnv): boolean {
  return Object.entries(env).some(([key, value]) => Boolean(value) && /(?:_EMULATOR_HOST|_EMULATOR_HUB)$/.test(key));
}
export function loopbackHost(value: string | undefined): boolean {
  if (!value || value.includes('://')) return false;
  try {
    const url = new URL(`http://${value}`);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port.length > 0
      && url.pathname === '/' && !url.username && !url.password;
  } catch { return false; }
}
export function requireDemoEmulators(env: NodeJS.ProcessEnv = process.env): string {
  const project = env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT;
  if (project !== DEMO_PROJECT || !loopbackHost(env.FIREBASE_DATABASE_EMULATOR_HOST)
    || !loopbackHost(env.FIREBASE_AUTH_EMULATOR_HOST)) {
    throw new Error('Refusing fixture access: use demo-narayana-naturals with loopback Realtime Database and Auth emulator hosts.');
  }
  return project;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.BACKEND_MODE ?? 'emulator';
  const stage = parseStoreStage(env.STORE_STAGE);
  if (!['emulator', 'firebase'].includes(mode)) throw new Error('BACKEND_MODE must be emulator or firebase.');
  const isEmulator = mode === 'emulator';
  if (isEmulator) {
    env.GCLOUD_PROJECT ??= DEMO_PROJECT;
    env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';
    requireDemoEmulators(env);
  } else if (hasEmulatorHosts(env) || env.GCLOUD_PROJECT !== LIVE_PROJECT) {
    throw new Error('Live mode requires the owner project and no emulator variables.');
  }
  const projectId = isEmulator ? DEMO_PROJECT : LIVE_PROJECT;
  const databaseURL = isEmulator ? DEMO_DATABASE_URL : env.DATABASE_URL;
  if (!databaseURL || (!isEmulator && databaseURL !== LIVE_DATABASE_URL)) {
    throw new Error('Set DATABASE_URL to the owner Realtime Database URL.');
  }
  const port = Number(env.PORT ?? 5002);
  const host = env.HOST ?? '127.0.0.1';
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !['127.0.0.1', '0.0.0.0', '::1'].includes(host)) {
    throw new Error('Choose a valid API host and port.');
  }
  const origins = (env.ALLOWED_ORIGINS ?? (isEmulator ? 'http://localhost:3000,http://127.0.0.1:3000' : ''))
    .split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try {
      const url = new URL(origin);
      const privateLoopback = stage === 'private-draft' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        && url.protocol === 'http:';
      return url.origin !== origin || (!isEmulator && url.protocol !== 'https:' && !privateLoopback);
    }
    catch { return true; }
  })) throw new Error('ALLOWED_ORIGINS must contain explicit valid origins; live origins must use HTTPS except explicit private-draft loopback development.');
  return { mode, stage, commerceRoot: commerceRoot(stage), isEmulator, projectId, databaseURL, port, host, origins };
}
