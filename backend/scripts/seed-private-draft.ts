import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { initializePrivateDraft, requirePrivateDraftSeedConfig } from './private-draft.js';

async function main() {
  const config = requirePrivateDraftSeedConfig();
  const credential = applicationDefault();
  try { await credential.getAccessToken(); }
  catch { throw new Error('Application Default Credentials are required to initialize the owner private draft.'); }
  const app = initializeApp({ ...config, credential }, 'private-draft-initialization');
  try {
    const created = await initializePrivateDraft(getDatabase(app));
    console.log(created
      ? 'Initialized commerceDraft with private test samples. Test orders will not be fulfilled. No Auth accounts were created.'
      : 'commerceDraft already exists. Existing test configuration, orders and retry receipts were left unchanged.');
  } finally { await deleteApp(app); }
}
main().catch(error => {
  console.error(error instanceof Error && /^(Refusing private draft initialization:|Application Default Credentials are required)/.test(error.message)
    ? error.message : 'Private draft initialization failed. No existing commerce ledger was overwritten.');
  process.exitCode = 1;
});
