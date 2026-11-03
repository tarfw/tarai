# Note Review — later

## Drawers: frosted backdrop (2026-10-29)

Deferred: needs a native module, so it waits for the next dev-client APK build.

Wanted: `BlurView` above the inbox/workspaces drawer instead of the flat 40% dim.
- `npx expo install expo-blur` (installed and removed once already; package.json must not keep it until the APK carries it).
- In `Sheet` (tarapp/src/app/canvas.tsx): `BlurView intensity={55} tint={resolvedScheme === 'dark' ? 'dark' : 'light'} blurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}`, then a `pointerEvents="none"` veil `rgba(0,0,0,0.18)` over it.
- Backdrop keeps the full-size `Pressable` so a tap closes the drawer; Android hardware back already closes it through `onRequestClose`.
- Do not remove the dim fallback, so the sheet still reads if blur is unavailable.

## Rotate the Rivet cluster admin token (2026-11-02)

Deferred — low urgency, but do it before the cluster holds real money.

The Rivet API returns `admin_token` in the cluster JSON (`npx @rivetkit/cli api /v2/clusters/tar`), and that output landed in a session transcript on 2026-11-02. Treat it as shown.

- Nothing in this repo uses it. The app's `/mint` route signs with `RIVET_TOKEN` on the runner ([tarserver/index.ts:888](tarserver/index.ts)), not the admin token.
- v2 API has no rotation endpoint. v1 has `/byoc/v1/clusters/{cluster}/tokens/operator`.
- **Do it from the dashboard** (dashboard.rivet.dev → cluster `tar` → Settings → token), because that re-applies the token to the runner. A raw CLI rotation can leave the runner env stale and silently break phone sign-in.
- After rotating: redeploy, then confirm `/mint` still returns a token and the app still loads the Canvas.

