import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { requirePrivateDraftSeedConfig } from './private-draft.js';

async function main() {
  const config = requirePrivateDraftSeedConfig();
  const app = initializeApp({ ...config, credential: applicationDefault() }, 'owner-access');
  try {
    const auth = getAuth(app);
    const owner = await auth.getUserByEmail('narayananaturals@gmail.com');
    if (owner.disabled || !owner.providerData.some(provider => provider.providerId === 'password')) {
      throw new Error('The owner must have an active email/password account.');
    }
    await auth.setCustomUserClaims(owner.uid, { ...owner.customClaims, admin: true, tester: true });
    const verified = await auth.getUser(owner.uid);
    if (verified.customClaims?.admin !== true || verified.customClaims?.tester !== true) throw new Error('Owner access could not be verified.');
    console.log('Owner access verified. Sign out and back in to refresh the account permissions.');
  } finally { await deleteApp(app); }
}

main().catch(error => {
  if ((error as { code?: string }).code === 'auth/user-not-found') {
    console.error('Create narayananaturals@gmail.com through the real website or Android email/password sign-up first. No account or password was created by this command.');
  } else {
    console.error(error instanceof Error && /^(Refusing private draft initialization:|The owner must)/.test(error.message)
      ? error.message : 'Owner access could not be updated. Check the owner project and trusted server credentials.');
  }
  process.exitCode = 1;
});
