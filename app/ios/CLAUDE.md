# Cheklistr — iOS / Capacitor Build

**Directory:** `app/ios/`
**Approach:** Capacitor 7.2.0 wrapping the existing PWA web app
**Config:** `capacitor.config.ts` at repo root
**Status:** Active workstream — native build in progress, PWA remains primary deployment

---

## What This Stream Is

The iOS build is **not** a separate native app. It is Capacitor wrapping the existing React/TypeScript web app, providing:

- Native camera access (replacing PWA camera API)
- GPS/geolocation (native, more reliable than browser API)
- Biometric auth (fingerprint / Face ID)
- Secure storage (Capacitor Preferences, replacing localStorage for sensitive data)

The same `app/src/` codebase runs both the PWA and the native build. Platform-specific behaviour is gated in `lib/` modules.

---

## Capacitor Plugin Map

| Capability | Plugin | Module |
|-----------|--------|--------|
| Camera | `@capacitor/camera` | `lib/nativeCamera.ts` |
| Geolocation | `@capacitor/geolocation` | `lib/nativeGeolocation.ts` |
| Biometric Auth | `@aparajita/capacitor-biometric-auth` | `lib/biometricAuth.ts` |
| Secure Storage | `@capacitor/preferences` | `lib/secureStorage.ts` |

---

## Build Process

```bash
# 1. Build the web app first
cd app && npm run build

# 2. Sync web assets into Capacitor
npx cap sync ios

# 3. Open in Xcode
npx cap open ios

# 4. Build/run from Xcode
```

**Important:** Always run `npm run build` before `cap sync`. The iOS build uses the compiled `dist/` output, not the dev server.

---

## Platform Detection Pattern

Use Capacitor's `Capacitor.isNativePlatform()` to gate native-only behaviour:

```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Use native plugin
} else {
  // Fall back to web API
}
```

This pattern is used in `nativeCamera.ts`, `nativeGeolocation.ts`, and `biometricAuth.ts`. Maintain this pattern for any new native features — the same code must work in both PWA and native contexts.

---

## Key Considerations

- **PWA remains primary** — Any change to `lib/nativeCamera.ts`, `lib/nativeGeolocation.ts` etc. must preserve the web fallback path. Do not make these modules native-only.
- **Image pipeline unchanged** — Native camera output still goes through `imageCompressor.ts` (1280px, 60% JPEG) before IndexedDB storage. Do not bypass compression for native builds.
- **Permissions** — iOS requires `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription` etc. in `Info.plist`. These are managed by Capacitor sync — do not edit `Info.plist` manually.
- **Offline behaviour** — The offline-first IndexedDB architecture applies identically to native. Do not add network-dependent native-only paths.

---

## Current Status / Next Steps

- [ ] Confirm Capacitor sync completes cleanly after latest `app/src` changes
- [ ] Verify biometric auth flow on device (Face ID / Touch ID)
- [ ] Test photo pipeline end-to-end on physical iOS device
- [ ] Confirm signed URL handling works in native WKWebView (cookie/header behaviour differs)
- [ ] App Store submission prep (bundle ID, provisioning profiles, icons)

---

## Known Issues

- Signed URLs: WKWebView (iOS native) handles auth headers differently to mobile Chrome. Test `<SignedImage>` regeneration on device, not just in browser.
- `supabase.functions.invoke()` hang: The raw `fetch()` pattern in `syncSubmission.ts` and `vehicleLookup.ts` is especially important in native context where token refresh timing is less predictable.
