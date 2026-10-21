import type { Database } from 'firebase-admin/database';
import type { Auth } from 'firebase-admin/auth';
import { DEMO_PROJECT, requireDemoEmulators } from '../src/config.js';
export { DEMO_PROJECT, requireDemoEmulators };
export const PREVIEW_PASSWORD = 'NarayanaDemo123!';
export const PREVIEW_ADDRESS = { name: 'ప్రివ్యూ కొనుగోలుదారు', phone: '6000000001',
  street: '12 Preview Street', city: 'Chittoor', pin: '517001' };
export const PREVIEW_USERS = {
  customer: { uid: 'preview-customer', email: 'customer@narayana.test', displayName: 'Preview customer' },
  other: { uid: 'preview-other', email: 'other@narayana.test', displayName: 'Preview other customer' },
  owner: { uid: 'preview-owner', email: 'owner@narayana.test', displayName: 'Preview owner' },
};
export function previewCommerce() {
  const local = { enabled: true, local: true, feePaise: 0, extraLitrePaise: 0, includedLitres: 0,
    codAllowed: true, estimate: 'Preview: 1–2 days', preview: true };
  const national = { enabled: true, local: false, feePaise: 12000, extraLitrePaise: 2500, includedLitres: 2,
    codAllowed: true, estimate: 'Preview: 4–7 days', preview: true };
  return {
    publicContent: { storefront: { orderingEnabled: true, onlinePaymentsEnabled: false, preview: true,
      notice: { en: 'Emulator preview: illustrative prices, stock and delivery rules. No real orders.',
        te: 'ఎమ్యులేటర్ ప్రివ్యూ: ధరలు, స్టాక్, డెలివరీ నియమాలు ఉదాహరణలు మాత్రమే. నిజమైన ఆర్డర్లు కావు.' } } },
    products: { 'groundnut-oil': { published: true, preview: true,
      name: { en: 'Groundnut oil', te: 'వేరుశనగ నూనె' },
      description: { en: 'Bull-driven wooden Ghani groundnut oil. Preview product information.',
        te: 'ఎద్దుతో నడిచే చెక్క గానుగలో తయారైన వేరుశనగ నూనె. ప్రివ్యూ ఉత్పత్తి సమాచారం.' },
      ingredients: { en: 'Groundnuts. Confirm the final package label before sale.', te: 'వేరుశనగలు. అమ్మకానికి ముందు తుది ప్యాకేజీ లేబుల్ నిర్ధారించాలి.' },
      extraction: { en: 'Bull-driven wooden Ghani', te: 'ఎద్దుతో నడిచే చెక్క గానుగ' },
      storage: { en: 'Storage guidance awaits owner confirmation.', te: 'నిల్వ సూచనలను యజమాని నిర్ధారించాలి.' } } },
    variants: {
      '1l': { id: '1l', litres: 1, pricePaise: 45000, stock: 12, enabled: true, preview: true },
      '2l': { id: '2l', litres: 2, pricePaise: 90000, stock: 8, enabled: true, preview: true },
      '5l': { id: '5l', litres: 5, pricePaise: 225000, stock: 4, enabled: true, preview: true },
    },
    deliveryRules: Object.fromEntries([
      ...['523201', '517001', '517501'].map(pin => [pin, { ...local }] as const),
      ...['500001', '110001', '560001', '600001'].map(pin => [pin, { ...national }] as const),
    ]),
  };
}
export async function seedPreviewDatabase(db: Database) {
  requireDemoEmulators();
  const preview = previewCommerce();
  await db.ref().update({ 'commerce/publicContent': preview.publicContent, 'commerce/products': preview.products,
    'commerce/variants': preview.variants, 'commerce/deliveryRules': preview.deliveryRules });
  for (const user of Object.values(PREVIEW_USERS)) {
    await db.ref(`users/${user.uid}/profile`).set({ displayName: user.displayName, email: user.email, language: 'en' });
  }
}
export async function seedPreviewAuth(auth: Auth) {
  requireDemoEmulators();
  for (const user of Object.values(PREVIEW_USERS)) {
    const profile = { email: user.email, displayName: user.displayName, password: PREVIEW_PASSWORD, emailVerified: true };
    try { await auth.createUser({ uid: user.uid, ...profile }); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error;
      await auth.updateUser(user.uid, profile);
    }
    await auth.setCustomUserClaims(user.uid, user.uid === PREVIEW_USERS.owner.uid ? { admin: true } : {});
  }
}
