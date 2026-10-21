import type { Database } from 'firebase-admin/database';
import { LIVE_DATABASE_URL, LIVE_PROJECT, hasEmulatorHosts } from '../src/config.js';
import { previewCommerce } from './fixtures.js';

export function requirePrivateDraftSeedConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.BACKEND_MODE !== 'firebase' || env.STORE_STAGE !== 'private-draft' || env.GCLOUD_PROJECT !== LIVE_PROJECT
    || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== LIVE_PROJECT)
    || env.DATABASE_URL !== LIVE_DATABASE_URL || hasEmulatorHosts(env)) {
    throw new Error('Refusing private draft initialization: explicitly select the owner Firebase project, private-draft stage, owner database URL and no emulator hosts.');
  }
  return { projectId: LIVE_PROJECT, databaseURL: LIVE_DATABASE_URL };
}

export function privateDraftCommerce() {
  const preview = previewCommerce();
  return { ...preview,
    publicContent: { storefront: { ...preview.publicContent.storefront,
      orderingEnabled: false, stage: 'private-draft', testOnly: true, fulfilmentEnabled: false,
      notice: { en: 'Private demonstration: example prices only. Stock and delivery terms await confirmation. Orders and payments are disabled.',
        te: 'ప్రైవేట్ ప్రదర్శన: ధరలు ఉదాహరణలు మాత్రమే. స్టాక్, డెలివరీ వివరాలు ఇంకా నిర్ధారించాలి. ఆర్డర్లు, చెల్లింపులు నిలిపివేయబడ్డాయి.' } } },
    products: { 'groundnut-oil': { ...preview.products['groundnut-oil'],
      description: { en: 'Bull-driven wooden Ghani groundnut oil. Private demonstration; example prices are not a sale offer.',
        te: 'ఎద్దుతో నడిచే చెక్క గానుగలో తయారైన వేరుశనగ నూనె. ప్రైవేట్ ప్రదర్శన; ఉదాహరణ ధరలు అమ్మకపు ఆఫర్ కాదు.' } } },
    // No packed stock or delivery charge has been confirmed for this draft.
    // Zero values are non-sale placeholders; ordering remains disabled.
    variants: {
      '1l': { ...preview.variants['1l'], stock: 0, stockConfirmed: false },
      '2l': { ...preview.variants['2l'], stock: 0, stockConfirmed: false },
      '5l': { ...preview.variants['5l'], stock: 0, stockConfirmed: false },
    },
    deliveryRules: { '517502': { enabled: true, local: true, preview: true,
      feePaise: 0, extraLitrePaise: 0, includedLitres: 0, codAllowed: false,
      termsConfirmed: false, estimate: 'Demonstration only; delivery terms pending' } },
  };
}

// This helper is exercised only against the isolated emulator in tests. The
// executable entry point verifies the live configuration and ADC first.
export async function initializePrivateDraft(db: Database): Promise<boolean> {
  const seed = privateDraftCommerce();
  const result = await db.ref('commerceDraft').transaction(value => value === null ? seed : undefined, undefined, false);
  return result.committed;
}
