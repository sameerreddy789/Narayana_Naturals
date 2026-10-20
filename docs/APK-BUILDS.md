# Internal APK builds

Built on 20 October 2026 from the final Realtime Database implementation.
Files are in the local `artifacts/` folder and are ignored by Git. All four
builds contain the latest Android account-connection correction.

| File | Mode | Connection | Bytes |
| --- | --- | --- | ---: |
| `narayana-naturals-preview.apk` | `demo` | Standalone device-local sample store | 55,768,048 |
| `narayana-naturals-emulator.apk` | `emulator` | Android emulator → laptop `10.0.2.2` | 55,768,052 |
| `narayana-naturals-usb.apk` | `emulator` | USB phone → laptop through reversed `127.0.0.1` ports | 55,768,052 |
| `narayana-naturals-firebase.apk` | `firebase` | Owner Firebase project; public API/setup still required | 55,768,044 |

Each is approximately 53.2 MiB, package `com.narayananaturals.app`, version
`1.0.0+1`, minimum Android API 24 and target API 36. Architectures are
`arm64-v8a`, `armeabi-v7a` and `x86_64`. Installing another mode replaces the
existing app because they share the package ID.

## Choose an APK

Use the standalone preview to inspect the app immediately without a server.
Its accounts, cart and orders remain local to the device.

Use the emulator build to test the shared website/Android backend from an
Android emulator. Keep Auth 9099, Realtime Database 9000 and Node API 5002
running on the laptop.

For a physical Android phone, enable USB debugging, authorize this laptop,
keep those three services running, and execute from the repository root:

```powershell
adb reverse tcp:9099 tcp:9099
adb reverse tcp:9000 tcp:9000
adb reverse tcp:5002 tcp:5002
adb install -r artifacts/narayana-naturals-usb.apk
```

Use `adb -s <device-serial>` when more than one device is attached. The
phone needs the USB connection for this local test build. Sign in with the
same local email account used on the website. Fixture customer credentials
are documented in the [root tutorial](../README.md).

The Firebase build contains the registered owner Android configuration.
It has no hosted API URL or App Check provider. Complete
[live backend setup](BACKEND-SETUP.md) and rebuild before real checkout.

## Signing and integrity

These APK signatures passed verification. They use the local Android debug
certificate and `INTERNAL_BUILD=true`; public distribution requires owner
release signing and the final live environment.

Local signer certificate SHA-256:

```text
adab39cbd125a9fca67d87181067cf6fefd3dbfdb3fd8663ba70e43afa17b4cf
```

| File | SHA-256 |
| --- | --- |
| Preview | `05347021cc0950f67e26d53e19fce58ec30c8475ba10167055f23245f6a01a50` |
| Emulator | `9a4439a44ad3c59ef7e8517d7ba8620589eab3d4baaf3257b851497a12c06ed7` |
| USB | `b178b952e80bc09ea4dc9920679f2be4156f688f3c6a39b7bbf5536bb1c93a93` |
| Firebase | `285480f08ffb957289e003728e69cb0a6fe2ea3a75cbed3fafabd23ad0cb4930` |

`artifacts/APK-MANIFEST.json` records the exact modes, hosts, build times,
sizes and hashes. These hashes identify the local files, not APKs built on
another machine. GitHub Actions uses its own internal signing key and
uploads a standalone preview under `narayana-naturals-android-preview`.
