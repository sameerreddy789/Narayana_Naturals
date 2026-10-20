import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const environment = {
  ...process.env,
  GCLOUD_PROJECT: process.env.GCLOUD_PROJECT ?? 'demo-narayana-naturals',
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
};

// The seed entry point independently validates loopback hosts and the demo
// project before initializing Admin SDK. Never silently override a cloud target.
if (environment.GCLOUD_PROJECT !== 'demo-narayana-naturals') {
  throw new Error('Seed only the demo-narayana-naturals emulator project.');
}
for (const host of [environment.FIRESTORE_EMULATOR_HOST, environment.FIREBASE_AUTH_EMULATOR_HOST]) {
  if (!/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(host)) {
    throw new Error('Emulator seed hosts must be loopback addresses.');
  }
}

const child = spawn(process.execPath, [path.join(root, 'functions/lib/scripts/seed-emulator.js'), ...process.argv.slice(2)], {
  cwd: root, env: environment, stdio: 'inherit', windowsHide: true,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
