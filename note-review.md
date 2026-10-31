# Note Review — later

## Drawers: frosted backdrop (2026-10-29)

Deferred: needs a native module, so it waits for the next dev-client APK build.

Wanted: `BlurView` above the inbox/workspaces drawer instead of the flat 40% dim.
- `npx expo install expo-blur` (installed and removed once already; package.json must not keep it until the APK carries it).
- In `Sheet` (tarapp/src/app/canvas.tsx): `BlurView intensity={55} tint={resolvedScheme === 'dark' ? 'dark' : 'light'} blurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}`, then a `pointerEvents="none"` veil `rgba(0,0,0,0.18)` over it.
- Backdrop keeps the full-size `Pressable` so a tap closes the drawer; Android hardware back already closes it through `onRequestClose`.
- Do not remove the dim fallback, so the sheet still reads if blur is unavailable.
