# Push (expo-notifications) — what changed, and what the next build must do

## Why this note exists

The rebuild added `expo-notifications` as a dependency. The dev APK installed on
the phone was built ~20 days before that, so its binary has no notifications
native module. `src/app/canvas.tsx` imports `src/lib/push.ts`, which loads
`expo-notifications` — so opening Canvas on the old APK failed with:

```
ERROR [Error: Cannot find native module 'ExpoPushTokenManager']
  requireNativeModule … PushTokenManager.native.js
```

The trap worth remembering: on native, a missing native module is reported
through `global.ErrorUtils` as a **fatal** error. It never reaches a JS
`try/catch`, and a lazy `await import('expo-notifications')` inside a `try`
still redboxes. The only thing that works on native is to *not touch the module
at all* when the binary doesn't have it.

## What is in the code now (keep it)

`src/lib/push.ts`:

```ts
import { requireOptionalNativeModule } from 'expo';

export async function registerPush(force = false): Promise<void> {
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return;   // old binary: silent no-op
  ...
  const Notifications = await import('expo-notifications');           // only after the gate passes
  ...
}
```

- **Old APK (module missing):** `requireOptionalNativeModule` returns null, push
  is skipped, everything else on the app works.
- **New APK (module present):** gate passes → permission → device token →
  `POST /v1/push/register` → row in D1 `push_tokens`.

Do **not** remove the gate "because the module exists now". It costs nothing on
builds that have the module, and removing it re-introduces the redbox on any
binary built before the module landed (every stale dev build in the field).

## Before the next EAS build

- [ ] `npx expo install --check` — `expo-notifications` must be `~57.0.24`
      (the SDK 57 line). It had been pinned to `58.1.6`, the wrong major for
      this SDK; already corrected to `~57.0.24` in `package.json`.
      The same command may also flag `expo`, `expo-router`, etc. — decide as a
      set whether to align all of them before the build.
- [ ] Optional but recommended: add `"expo-notifications"` to the `plugins`
      array in `app.json` (notification icon, colour, default Android channel).
      Basic delivery works without it; the app icon is used as the default.
- [ ] Android delivery needs FCM **V1** credentials uploaded once in the Expo
      dashboard: project `efb1d63a-cd61-4d36-8906-a2fefc57b4f8` → Cloud
      Messaging → upload the service-account JSON of the Firebase project that
      owns `google-services.json` (already in the repo root and wired via
      `android.googleServicesFile`). Tokens register either way; messages are
      silently dropped without this.
- [ ] Server secret, once: create an Expo access token (expo.dev → Settings →
      Access Tokens), then

      ```bash
      cd tarharness && npx wrangler secret put EXPO_ACCESS_TOKEN
      ```

      Without it `src/push/expo.ts` returns early — registration succeeds,
      sending is a no-op. (`TELEGRAM_BOT_TOKEN` is a separate adapter secret.)
- [ ] Build (EAS cloud only — nothing native is built locally):

      ```bash
      cd tarapp
      npx eas-cli@latest build -p android --profile development
      ```

- [ ] Install the new APK over the old one. Same package `com.tarfw.app` and
      the same EAS keystore, so it upgrades in place and Google sign-in
      (registered SHA-1) keeps working.

## After the build — verify

1. `npx expo start --dev-client` in `tarapp`, press `r` in Metro.
2. First Canvas load shows the Android notification permission prompt → allow.
3. Row exists on the server:

   ```bash
   cd tarharness
   npx wrangler d1 execute tarharness-control --remote \
     --command "select user, platform, updated from push_tokens"
   ```

4. No `Cannot find native module` in the Metro log (if it reappears, the gate
   in `src/lib/push.ts` was removed or bypassed).
5. End to end: create an urgent inbox row (`!`) → the phone shows a
   lock-screen/banner notification. Follow it with `npx wrangler tail` in
   `tarharness`; a send failure shows up as an `exp.host` error there.
6. APNs / iOS is still deferred — this path is Android only.

## Failure reference

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `Cannot find native module 'ExpoPushTokenManager'` | binary predates `expo-notifications` | new dev build (or the gate was removed) |
| registers, no delivery | `EXPO_ACCESS_TOKEN` not set, or FCM V1 key not uploaded | `wrangler secret put EXPO_ACCESS_TOKEN`; upload service-account JSON in Expo |
| `exp.host` 400/`DeviceNotRegistered` | stale or revoked FCM credentials | re-upload FCM V1 credentials, then clear `tar_push_registered_at` in SecureStore (relogin forces a new registration) |
