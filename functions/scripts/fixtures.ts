import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

export const DEMO_PROJECT = 'demo-narayana-naturals';
export const PREVIEW_LOCAL_PINS = ['523201', '517001', '517501'] as const;
const previewLocalRule = { enabled: true, local: true, feePaise: 0, extraLitrePaise: 0,
  includedLitres: 0, codAllowed: true, estimate: 'Preview: 1–2 days', preview: true };
export const PREVIEW_ADDRESS = { name: 'ప్రివ్యూ కొనుగోలుదారు', phone: '6000000001',
  street: '12 Preview Street', city: 'Preview Town', pin: '523201' };
export const PREVIEW_USERS = {
  customer: { uid: 'preview-customer', phoneNumber: '+916000000001', displayName: 'Preview customer' },
  other: { uid: 'preview-other', phoneNumber: '+916000000002', displayName: 'Preview other customer' },
  owner: { uid: 'preview-owner', phoneNumber: '+916000000003', displayName: 'Preview owner' },
};

function loopbackHost(value: string | undefined): boolean {
  if (!value || value.includes('://')) return false;
  try {
    const url = new URL(`http://${value}`);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port.length > 0
      && url.pathname === '/' && !url.username && !url.password;
  } catch { return false; }
}
export function requireDemoEmulators(env: NodeJS.ProcessEnv = process.env): string {
  const project = env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? DEMO_PROJECT;
  if (project !== DEMO_PROJECT || !loopbackHost(env.FIRESTORE_EMULATOR_HOST)
    || !loopbackHost(env.FIREBASE_AUTH_EMULATOR_HOST)) {
    throw new Error('Refusing fixture access: use demo-narayana-naturals with loopback Firestore and Auth emulator hosts.');
  }
  return project;
}

export async function seedPreviewFirestore(db: Firestore): Promise<void> {
  // This guard is inside the reusable seed too, so importing it cannot bypass the safety check.
  requireDemoEmulators();
  const batch = db.batch();
  batch.set(db.doc('publicContent/storefront'), { orderingEnabled: true, onlinePaymentsEnabled: false, preview: true,
    notice: { en: 'Emulator preview: illustrative prices, stock and delivery PIN rules. No real orders.',
      te: 'ఎమ్యులేటర్ ప్రివ్యూ: ధరలు, స్టాక్, డెలివరీ పిన్ నియమాలు ఉదాహరణలు మాత్రమే. నిజమైన ఆర్డర్లు కావు.' } });
  batch.set(db.doc('products/groundnut-oil'), { published: true, preview: true,
    name: { en: 'Groundnut oil', te: 'వేరుశనగ నూనె' },
    description: { en: 'Bull-driven wooden Ghani groundnut oil. Preview product information.',
      te: 'ఎద్దుతో నడిచే చెక్క గానుగలో తయారైన వేరుశనగ నూనె. ప్రివ్యూ ఉత్పత్తి సమాచారం.' },
    ingredients: { en: 'Groundnuts. Confirm the final package label before sale.', te: 'వేరుశనగలు. అమ్మకానికి ముందు తుది ప్యాకేజీ లేబుల్ నిర్ధారించాలి.' },
    extraction: { en: 'Bull-driven wooden Ghani', te: 'ఎద్దుతో నడిచే చెక్క గానుగ' },
    storage: { en: 'Storage guidance awaits owner confirmation.', te: 'నిల్వ సూచనలను యజమాని నిర్ధారించాలి.' } });
  const variants = [{ id: '1l', litres: 1, pricePaise: 45000, stock: 12, enabled: true, preview: true },
    { id: '2l', litres: 2, pricePaise: 90000, stock: 8, enabled: true, preview: true },
    { id: '5l', litres: 5, pricePaise: 225000, stock: 4, enabled: true, preview: true }];
  for (const variant of variants) {
    batch.set(db.doc(`products/groundnut-oil/variants/${variant.id}`), variant);
    batch.set(db.doc(`_inventory/${variant.id}`), { availablePacks: variant.stock, preview: true, updatedAt: new Date().toISOString() });
  }
  for (const pin of PREVIEW_LOCAL_PINS) batch.set(db.doc(`deliveryRules/${pin}`), previewLocalRule);
  for (const pin of ['500001', '110001', '560001', '600001']) {
    batch.set(db.doc(`deliveryRules/${pin}`), { enabled: true, local: false, feePaise: 12000,
      extraLitrePaise: 2500, includedLitres: 2, codAllowed: true, estimate: 'Preview: 4–7 days', preview: true });
  }
  await batch.commit();
}
export async function seedAdditionalLocalPins(db: Firestore): Promise<void> {
  requireDemoEmulators();
  const batch = db.batch();
  for (const pin of PREVIEW_LOCAL_PINS.filter(pin => pin !== '523201')) {
    batch.set(db.doc(`deliveryRules/${pin}`), previewLocalRule);
  }
  await batch.commit();
}
export async function seedPreviewAuth(auth: Auth): Promise<void> {
  requireDemoEmulators();
  for (const user of Object.values(PREVIEW_USERS)) {
    try { await auth.createUser(user); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error;
      const { uid, ...profile } = user;
      await auth.updateUser(uid, profile);
    }
  }
  await auth.setCustomUserClaims(PREVIEW_USERS.owner.uid, { admin: true });
}
