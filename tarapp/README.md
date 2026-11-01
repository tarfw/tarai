# TAR App

Expo/React Native client for Canvas (cards, flows, Ask TAR), commerce
interfaces, members and Site Studio.

Business state and mutations currently run through the legacy API; the client is
being migrated to the new Rivet actor backend. Replace the backend URL in
`eas.json` when the new actor endpoint is ready.

## Develop

```sh
npm install
npm start
```

Rebuild the Expo development client after installing native dependencies.

The development build uses the deployed legacy API unless
`EXPO_PUBLIC_TARHARNESS_URL` is set. Replace that value with the new Rivet
actor endpoint when it exists. `npx expo start` serves the app bundle; it
does not run or deploy the backend.

## Release checks

```sh
npx tsc --noEmit
npm run lint
npm run release:check
```

EAS profiles in `eas.json` point to the legacy API URL. Google identity
configuration must match the Android package and EAS project in `app.json`.
Update `eas.json` when the new actor endpoint is ready.

```sh
npx eas build --platform android --profile production
```

See [tarfw.md](../tarfw.md) for the Canvas concept, and [parfw.md](../parfw.md)
for the site builder.
