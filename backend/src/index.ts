import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getDatabase } from 'firebase-admin/database';
import { CommerceService } from './commerce.js';
import { loadConfig } from './config.js';
import { createCommerceServer } from './http.js';

try {
  const config = loadConfig();
  const app = initializeApp({ projectId: config.projectId, databaseURL: config.databaseURL,
    ...(config.isEmulator ? {} : { credential: applicationDefault() }) });
  const db = getDatabase(app);
  const server = createCommerceServer({ service: new CommerceService(db, { isEmulator: config.isEmulator, stage: config.stage }),
    auth: getAuth(app), appCheck: config.isEmulator ? undefined : getAppCheck(app),
    isEmulator: config.isEmulator, origins: config.origins, projectId: config.projectId,
    health: async () => {
      const snapshot = await db.ref(`${config.commerceRoot}/publicContent/storefront`).get();
      return { configured: snapshot.exists(), orderingEnabled: snapshot.child('orderingEnabled').val() === true,
        onlinePaymentsEnabled: snapshot.child('onlinePaymentsEnabled').val() === true };
    } });
  server.listen(config.port, config.host, () => {
    console.log(`Narayana Naturals ${config.mode} ${config.stage} API: http://${config.host}:${config.port} (Realtime Database + email login)`);
  });
  const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The API could not start.');
  process.exitCode = 1;
}
