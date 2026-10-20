import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { loadConfig } from '../src/config.js';
import { PREVIEW_USERS, PREVIEW_PASSWORD, requireDemoEmulators, seedPreviewAuth, seedPreviewDatabase } from './fixtures.js';

async function main() {
  const config = loadConfig();
  requireDemoEmulators();
  const app = initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL }, 'emulator-seed');
  try {
    await seedPreviewAuth(getAuth(app));
    await seedPreviewDatabase(getDatabase(app));
    console.log('Seeded only demo-narayana-naturals loopback Auth and Realtime Database emulators.');
    console.log(`Preview accounts: ${Object.values(PREVIEW_USERS).map(user => user.email).join(', ')}. Password: ${PREVIEW_PASSWORD}`);
  } finally { await deleteApp(app); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
