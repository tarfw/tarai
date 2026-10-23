# TAR App

Expo/React Native client for Canvas (cards, flows, Ask TAR), commerce
interfaces, members and Site Studio. Business state and mutations stay in TAR
Harness. Now keeps a local Turso database synchronized one way from a dedicated
per-user Inbox database. It shows saved work immediately and pulls fresh
projections after the Gateway refreshes source workspaces. Rows open their
source for fresh details and use its Gateway for changes. Offline actions are
unavailable until the source can be reached.

## Develop

```sh
npm install
npm start
```

Now uses `@tursodatabase/sync-react-native`, a native module. It calls `pull()`
to bring remote Inbox changes into the local database; it does not push local
writes because Now is read-only on the device.
Rebuild the Expo development client after installing dependencies; Expo Go and
an older development client cannot load it. The app requests short-lived,
read-only sync credentials from `GET /v1/inbox/sync`. The older
`GET /v1/inbox/replica` path remains an API compatibility alias, and the app
falls back to it when connected to an older Gateway. Credentials are held in
memory and never saved to the device. Signing out removes the local snapshot
and synced database files.

The development build uses the deployed TAR Harness unless
`EXPO_PUBLIC_TARHARNESS_URL` is set. `npx expo start` serves the app bundle; it
does not run or deploy the Worker. Failed requests print a `[Harness]` line in
the Expo terminal with the route, status, diagnostic code and elapsed time.
For backend details, inspect the Worker logs with `npx wrangler tail` from
`tarharness/`.

## Release checks

```sh
npx tsc --noEmit
npm run lint
npm run release:check
```

EAS profiles in `eas.json` point to the production Harness URL. Google identity
configuration must match the Android package and EAS project in `app.json`.

```sh
npx eas build --platform android --profile production
```

See [tarv4.md](../tarv4.md) for the Canvas concept, flow grammar, flow library
and commerce kernel, and [parai.md](../parai.md) for stores.
