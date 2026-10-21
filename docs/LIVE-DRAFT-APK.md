# Share the private Narayana Naturals draft

Updated 21 October 2026. This guide covers the Next.js website and Flutter
APK using real Firebase email/password Authentication, Realtime Database
and the hosted Node API. Both use project `narayananaturals-6b5aa` and the
private `commerceDraft` catalogue.

## What this draft demonstrates

The owner approved example prices of ₹450, ₹900 and ₹2,250 for the 1 L,
2 L and 5 L packs. The screens label these as example prices. Packed stock
is pending confirmation. The only demonstration delivery PIN is **517502**;
delivery charges and delivery estimates remain pending.

**A client-only demonstration checkout is enabled.** Add packs, enter an
address with PIN **517502**, review the example bill and choose **Confirm demo
payment**. The demo bill shows a clearly labelled ₹0 delivery charge. It does
not confirm a real delivery price or packed inventory. Up to 20 demo packs of
each size can be added without marking the physical stock as available.

**No money is collected. COD, merchant payments, backend order submission and
fulfilment remain disabled.** A demo receipt is saved locally for the signed-in
account in the current browser or Android installation, survives a restart,
and appears in Orders. These receipts do not synchronize across devices or
enter either Firebase order ledger. Removing app/browser data removes them.
Confirmation clears unchanged purchased cart lines; newer quantities and
other packs are kept. A failed cart cleanup leaves an actionable sync message
without reporting the saved receipt as a failed payment.
Accounts, saved addresses, profile/language preferences and first-use guidance
use real Firebase data. Production orders use a separate `commerce` ledger.
No sample account or shared App Check secret is included in the shipped UI.

## 1. Open the hosted website

- Website: https://narayana-naturals.onrender.com
- API: https://narayana-naturals-api.onrender.com
- Backend status: https://narayana-naturals-api.onrender.com/health

Both Render services use the Free plan in Oregon. They sleep when idle, so
the first visit can take longer. The cloud connection does not require the
owner's laptop to stay on. Public customer ordering will need suitable hosting
chosen by the owner.

## 2. Complete private App Check registration

App Check is enabled for this project. The developer registered the verification
browser and emulator separately and verified their token exchanges. Additional
testers must register their own browser or phone. If owner CLI authorization expires,
open a real PowerShell terminal and run:

```powershell
Set-Location 'D:\Hackathons\Narayana Naturals'
.\node_modules\.bin\firebase.cmd login --reauth
```

Choose `narayananaturals@gmail.com` and complete the CLI's login instructions.
Keep authorization codes in the terminal, and keep passwords/private keys out
of chat. Renewed owner access allows the developer to enable App Check and
register approved browser/device tokens through its official API.

The website generates a separate debug secret for each browser profile/origin.
The APK generates one per Android installation. In Firebase Console → App
Check → Apps → Manage debug tokens, register the secret for the corresponding
web or Android app. Browser tokens are available in the SDK's IndexedDB/developer
console. On the new APK, open **Account → Set up this test phone → Copy device
code**. Paste it into the Android app's **Manage debug tokens → Add debug token**
entry in Firebase Console. Use a distinct name for each phone. This action works
without root, USB or a store account and copies the SDK-generated installation
secret directly to the clipboard without displaying it. The device setup panel
and native channel are enabled only when the build explicitly selects Firebase,
the private draft, the debug provider and `INTERNAL_BUILD=true`.

Keep these tokens out of Git, screenshots and public messages. Reopen the phone
app after registration. Reinstalling with cleared app data generates a new code;
remove tokens for retired test installations from Firebase Console.

The web SDK uses its debug exchange with a `CustomProvider` whose fallback
fails closed. Android uses `AndroidDebugProvider`. The Node API requires
verified Firebase Auth and App Check tokens for authenticated operations.
Verify legitimate token exchanges before enabling database enforcement.
Public builds need real reCAPTCHA/Play Integrity providers and owner signing.

## 3. Create the real owner account

Use **Create account** on the website or phone with
`narayananaturals@gmail.com` and an owner-chosen password. A Google login to
Firebase Console does not create an email/password account in this store.

Owner access requires the trusted `admin:true` custom claim. After normal
registration, the developer can run the provided owner-access command:

```powershell
Set-Location 'D:\Hackathons\Narayana Naturals\backend'
$env:BACKEND_MODE = 'firebase'
$env:STORE_STAGE = 'private-draft'
$env:GCLOUD_PROJECT = 'narayananaturals-6b5aa'
$env:DATABASE_URL = 'https://narayananaturals-6b5aa-default-rtdb.firebaseio.com'
$env:GOOGLE_APPLICATION_CREDENTIALS = '<absolute path to private Admin JSON>'
npm run access:owner
```

This command grants only the approved owner email, preserves existing claims
and creates no account/password. Sign out and back in to refresh permissions.
Other invited testers need real accounts and a trusted `tester:true` claim for
private backend order history/API access. Local demo checkout, receipts, cart,
profile, address and guidance work for normal signed-in accounts without this
role. Registrations cannot grant themselves
roles. Guest catalogue browsing remains available.

## 4. Install the new APK

The developer preserves the connected build at:

```text
D:\Hackathons\Narayana Naturals\artifacts\narayana-naturals-live-draft.apk
```

Use the final build verification to confirm the file was produced. Older
`firebase`, `emulator`, `usb` and `preview` APKs are separate configurations.
Copy the new APK to the approved phone and open it. Android may ask to allow
installation from the app used to open the file. Complete this installation's
App Check registration, then sign in with the same account as the website.
No USB port forwarding or local API address is required.

The APK is internally signed and release-optimized for private testing.
Owner-controlled release signing remains necessary for public distribution.

## 5. Verify the shared connection

1. Check example prices, unconfirmed stock, PIN 517502 and the simulation notice.
   Confirm that no COD or merchant payment choice appears in checkout.
2. Register/sign in with real email/password and verify the UID exists in the
   owner Firebase Authentication project.
3. With a normal signed-in account, add packs and save an address on the website; check them on
   the phone using the same account. Change a profile/language preference and
   refresh/relaunch to verify persistence.
4. Check first-use guidance. Web and Android guide versions are separate
   because the page instructions differ between interfaces.
5. Check API health for `status: ok`, `mode: firebase`,
   `stage: private-draft`, `database: realtime`,
   `authentication: email_password`, `checkout: disabled` and
   `onlinePaymentsEnabled: false`.
6. Review a bill and confirm the demo payment. Check the local receipt and
   cleared cart, then reload/relaunch and verify the receipt remains. Confirm
   a different signed-in account cannot see that receipt. The backend's actual
   checkout must still reject orders; its ledgers must remain unchanged.
7. Test using another Wi-Fi network/mobile data with local services stopped.
   This confirms the phone uses the cloud connection.

Demo confirmation is a local UI simulation, not an online payment integration.
Real purchases require confirmed business data and a merchant payment flow.
Payment gateways,
automatic courier booking, push notifications and feedback integrations remain
future work.

## Developer hosting and build reference

| Setting | Website | API |
| --- | --- | --- |
| Render service | `Narayana_Naturals` | `narayana-naturals-api` |
| Root directory | Repository root | `backend` |
| Branch/runtime | `main`, Node 22 | `main`, Node 22 |
| Build | `npm ci --include=dev && npm run build` | `npm ci --workspaces=false --include=dev && npm run build` |
| Start | `node node_modules/next/dist/bin/next start apps/web --hostname 0.0.0.0 --port "$PORT"` | `npm start` |
| Health check | Website root | `/health` |

Use the supplied public **web** Firebase configuration plus:

```dotenv
NEXT_PUBLIC_BACKEND_MODE=firebase
NEXT_PUBLIC_STORE_STAGE=private-draft
NEXT_PUBLIC_COMMERCE_API_URL=https://narayana-naturals-api.onrender.com
NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG=true
```

Next.js public variables are embedded at build time. Rebuild after changing
the stage/API URL. The Node service uses:

```dotenv
BACKEND_MODE=firebase
STORE_STAGE=private-draft
GCLOUD_PROJECT=narayananaturals-6b5aa
DATABASE_URL=https://narayananaturals-6b5aa-default-rtdb.firebaseio.com
HOST=0.0.0.0
PORT=10000
ALLOWED_ORIGINS=https://narayana-naturals.onrender.com,http://localhost:3000,http://127.0.0.1:3000
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-admin.json
```

The private Admin JSON is a Render **secret file only on the API service**,
stored locally outside Git in `Documents/NarayanaSecrets`. It must never be
included in the website or APK. Android `google-services.json` is public
client configuration and cannot replace the server credential.

HTTP loopback origins are permitted only for private development; production
origins require HTTPS. For localhost, use the public Firebase values, private
stage and hosted API in `apps/web/.env.local`, restart `npm run dev` and open
http://localhost:3000.

The tested RTDB rules deny default reads/writes and scope personal data by UID.
The Admin API alone updates prices, stock and order state. `seed:private-draft`
creates only an absent `commerceDraft` atomically; it preserves existing orders,
retry receipts, users and production data.

Rebuild the private APK using:

```powershell
Set-Location 'D:\Hackathons\Narayana Naturals\apps\mobile'
$env:GRADLE_USER_HOME = 'D:\Hackathons\NarayanaBuildCache\gradle'
C:\flutter\bin\flutter.bat build apk --release --build-number=4 --dart-define=BACKEND_MODE=firebase --dart-define=STORE_STAGE=private-draft --dart-define=COMMERCE_API_URL=https://narayana-naturals-api.onrender.com --dart-define=APP_CHECK_PROVIDER=debug --dart-define=INTERNAL_BUILD=true
```

Generated output: `build/app/outputs/flutter-apk/app-release.apk`. Copy it to
the preserved path, verify the signing certificate and record its SHA-256.

## Official references

- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/app-check/web/debug-provider
- https://firebase.google.com/docs/app-check/flutter/debug-provider
- https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.debugTokens/create
- https://render.com/docs/web-services
- https://render.com/docs/configure-environment-variables#secret-files
- https://render.com/docs/free
