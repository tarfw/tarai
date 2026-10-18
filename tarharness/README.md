# TAR Harness

Cloudflare Worker for TAR's identity, workspace isolation, Action Gateway,
commerce kernel, Canvas projection and per-user sync, durable flows, sites
and channel ingress. The current product goal is [canvas.md](../canvas.md),
with [parai.md](../parai.md) and [commerce.md](../commerce.md) as linked
contracts.

## Local checks

```sh
npm install
npm run check
npm test
npx wrangler deploy --dry-run
```

## Production resources

| Binding | Resource |
| --- | --- |
| `CONTROL` | D1 control database; apply migrations in order (`0001_control.sql`, `0002_roles.sql`, `0003_context.sql`) |
| `OUTBOX` | queue for verified channel work and Inbox source-event projection |
| `FLOWS` | durable Flow Book workflow |
| `PRODUCT_CONTENT` | private catalog content bucket |
| `SITE_RELEASES` | immutable site release bucket |
| `AI` | optional Cloudflare Workers AI binding |

Required Worker secrets include Turso provisioning credentials. Jev, search and
chat provider secrets are optional; their related Actions are unavailable until
configured. Never put server secrets in Expo variables.

The complete workspace schema is applied when a workspace database is provisioned.
Each person has a separate Now Turso database containing only `inbox` and
`projection`. The app receives a short-lived, read-only token for that database.
Committed workspace Actions enqueue projection updates for active members. `GET /v1/inbox`
reads that projection, refreshes sources older than one minute, and preserves known
rows with a partial cue when a source fails. Opening a row reads the authorized
source again; its Gateway checks the version and permission at commit. Optional
Jev scoring marks one Next only among equally due existing actions. A change to
membership authority hides rows from the old projection until that source refreshes.

Turso database tokens are reused briefly per warm Worker instance; a failed token
request is retried on the next request. Workspace failures are logged with
`workspace.open.failed` or `workspace.query.failed` and a safe diagnostic code
is returned to the app.

```sh
npm run deploy
```

The Worker exposes health at `/health`, authenticated product APIs under `/v1`,
and published sites under `/v1/sites/:slug/*`.
