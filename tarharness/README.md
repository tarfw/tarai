# TAR Harness

Cloudflare Worker for TAR's identity, workspace isolation, the action gateway, the commerce kernel, Canvas projection and per-user sync, and sites. The current product goal is [tarfw.md](tarfw.md), with [parai.md](../parai.md) as the linked store contract.

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
| `PRODUCT_CONTENT` | private catalog content bucket |
| `SITE_RELEASES` | immutable site release bucket |
| `AI` | optional Cloudflare Workers AI binding |

## Architecture in one paragraph

Every workspace is its own Turso database behind the TAR API. The phone holds one session, reads one slice (kilobytes), and sends intents — never data, never a database token. A single write is one transaction: record + move + current + inbox. The event feed is a view over `move`; the inbox is a property of cards, and the badge opens the flat list of them. Freshness is ETag-driven: 304 means nothing changed, nearly free at any scale. Published sites live in R2 behind `*.tar.site` and the release is an immutable repoint.

Turso database tokens are reused briefly per warm Worker instance; a failed token request is retried on the next request. Workspace failures are logged with `workspace.open.failed` or `workspace.query.failed` and a safe diagnostic code is returned to the app.

```sh
npm run deploy
```

The Worker exposes health at `/health`, authenticated product APIs under `/v1`, and published sites under `/v1/sites/:slug/*`.
