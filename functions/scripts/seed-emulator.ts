import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { requireDemoEmulators, seedAdditionalLocalPins, seedPreviewAuth, seedPreviewFirestore } from './fixtures.js';

async function main() {
  const projectId = requireDemoEmulators();
  try {
    await Promise.all([process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST].map(host =>
      fetch(`http://${host}/`, { signal: AbortSignal.timeout(3000) })));
  } catch {
    throw new Error('Start the configured demo Firestore and Auth emulators before seeding. No fixture data was written.');
  }
  const app = initializeApp({ projectId });
  if (process.argv[2] === '--additional-local-pins') {
    await seedAdditionalLocalPins(getFirestore(app));
    console.log('Added emulator preview local PINs: Chittoor 517001 and Tirupati 517501. Existing catalogue/stock are unchanged.');
    return;
  }
  if (process.argv.length > 2) throw new Error('Unknown seed option. Use no option or --additional-local-pins.');
  await seedPreviewFirestore(getFirestore(app));
  await seedPreviewAuth(getAuth(app));
  console.log('Seeded demo-narayana-naturals emulator preview only. Prices, packed stock and PIN rates are illustrative.');
  console.log('Preview owner UID: preview-owner (admin:true). Auth emulator phone verification sends no real SMS.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
