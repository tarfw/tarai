# TAR harness runbook (tarfw rebuild)

## Deploy

```bash
cd tarharness
wrangler d1 migrations apply tarharness-control --remote   # 0008 drops Space/team-chat tables, 0009 adds push_tokens
wrangler deploy
```

## Secrets (wrangler secret put)

| Secret | What it is | Without it |
| :--- | :--- | :--- |
| `TAR_SESSION_SECRET` | >=32 chars signing TAR session JWTs | `/v1/auth/session` mints nothing; Google tokens keep working |
| `EXPO_ACCESS_TOKEN` | Expo push service token | the closed-phone bell is silent; badges still tell the truth |
| `TELEGRAM_BOT_TOKEN` | telegram adapter bot token | `channel.send` answers `not configured` |
| `TURSO_PLATFORM_TOKEN` | Turso Platform API token | workspace provisioning fails |
| `TYPESAFE_API_KEY` | Jev System One | birth/import/hire fall back to deterministic heuristics |

Vars already in wrangler.jsonc: `TURSO_ORG`, `TURSO_GROUP`, `SITE_WORKER_ORIGIN`,
OIDC (Google) audience. `TAR_MONTHLY_WRITE_CEILING` (default 10000)
caps writes per workspace per month; reads never stop.

## The laws this build enforces

- one write = record + move + current + inbox (truth engine; events are a view over move)
- money never runs auto (gate floor); money or customer always asks first
- stock never negative (onhand - reserved); postings balanced before commit
- one-tap undo lives as reverse actions (expense.reverse, refund.record, register overshort)
- Jev speaks three times: birth, import, hire — nowhere else
- device law: one TAR session; GET /me + GET /slice (ETag = last move id); writes are
  idempotent intents; no database token ever reaches a phone
- monthly close hash-sealed to R2; 90-day hot window; ceiling shared by writes and models

## Ops notes

- Existing dev workspaces predate the 6-table schema: re-create them (birth is
  idempotent and cheap). The D1 control plane is migrated in place.
- The sites worker (`sites/`) is unchanged; the `*.tar.site` wildcard still needs
  the zone + wrangler route when the domain lands (path mode serves meanwhile).
- App builds: `eas build` profiles unchanged (`development|preview|internal|production`);
  `npm run release:check` is the local pre-flight (types, lint, Metro bundle) — it
  never produces an APK.
