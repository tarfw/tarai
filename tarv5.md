# TAR v5 - Architecture

> Merchant describes business once. System builds Canvas, cards, flows. Every tap writes one record. No model at runtime.

```
WORDS → PLAN (LLM + Jev + Code) → CARD → GATE → RECORD → EVENT → INBOX → SYNC
```

## System boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT (Mobile/Web)                                         │
│  Canvas  Flows  Site  Inbox  You                           │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS + auth token
┌──────────────────┴──────────────────────────────────────────┐
│ GATEWAY (Cloudflare Workers)                                │
│  auth, rate limit, workspace routing                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────────┐
│ CORE API                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Card     │  │ Flow     │  │ Commerce │                 │
│  │ Builder  │  │ Runner   │  │ Kernel   │                 │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘                 │
│        │             │             │                        │
│        └─────────────┼─────────────┘                        │
│                      │                                      │
│  ┌───────────────────┴────────────────────┐                │
│  │ ACTION REGISTRY                        │                │
│  │ 116 registered: order.create, etc      │                │
│  └───────────────────┬────────────────────┘                │
└────────────────────┬─┴──────────────────┬─────────────────┘
                     │                    │
          ┌──────────┴────────┐  ┌────────┴─────────┐
          │ TURSO (Postgres)  │  │ R2 (Cloudflare)  │
          │ records, plans,   │  │ media, PDFs,     │
          │ inbox, workspace  │  │ site artifacts   │
          └───────────────────┘  └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL                                                    │
│  LLM (prose) → Jev (decisions) → BeatAPI (social, web)     │
└─────────────────────────────────────────────────────────────┘
```

## Seven laws

| # | Law | Enforced by |
| :-: | :--- | :--- |
| 1 | Every event writes balanced debit/credit | `validate_postings()` before commit |
| 2 | Stock never negative: available = onhand - reserved | `order.create` checks before reserve |
| 3 | Nothing erased. Archive only, log who/when/what | all actions write `archived_at`, never DELETE |
| 4 | One registry. New trade = new action + record type, never a table | 116 actions in `actions.ts`, one `records` table |
| 5 | Money or customer needs one confirm | gate derivation: `money → approve` |
| 6 | Every owner tap has one-tap undo | undo modifier creates reverse posting |
| 7 | No model on run. Cards and runs are deterministic | plan compiled once, L0/L1 reuse |

## Core vocabulary

| Term | Type | Stored | Lives |
| :--- | :--- | :--- | :--- |
| Workspace | boundary | Turso | shared DB, isolated by `workspace_id` |
| Canvas | view | computed | role + useful cards for this member |
| Card | UI + action | Turso | `{ title, metrics[], action, reach }` |
| Flow | plan | Turso plans | trigger + max 12 steps |
| Step | instruction | in plan | one CRUD, one action, one gate |
| Record | fact | Turso records | typed row: item, order, posting, etc |
| Action | write | registry | 116 registered, only way to commit |
| Event | notification | Turso events | triggers inbox items, canvas sync |
| Inbox | to-do | Turso inbox_items | role-filtered, auto-sorted |
| Run | execution | Turso runs | flow instance, step pointer |

## Data flow

```
 USER TAP
    |
    v
 GATE ────> token valid?
    |       workspace enabled?
    |       member has grant?
    |       idempotency key unique?
    v
 CRUD ────> read active prices, stock
    |       compute lines, tax, total
    |       validate (stock available, balance matches)
    v
 WRITE ───> BEGIN TRANSACTION
    |         INSERT records (order, invoice, payment)
    |         UPDATE stock (reserve)
    |         INSERT postings (debit cash, credit revenue)
    |         INSERT event
    |       COMMIT (all or nothing)
    v
 EVENT ───> INSERT inbox_items (role-filtered)
    |       NOTIFY clients via WebSocket
    v
 SYNC ────> every canvas refreshes
           every card re-reads metrics
```

## Lane separation

| Lane | Owns | Never | Example |
| :--- | :--- | :--- | :--- |
| Code | numbers, dates, grants, commits | asks model for derivable fact | stock = onhand - reserved |
| Jev | which of N, how risky, how useful | computes, grants, commits | pick tool from registry |
| LLM | prose, layout, card names | picks ids, decides, computes | "Evening Closing" title |
| Code | the commit, always | lets model influence write | `validate_postings()` |

A lane never crosses.

## Storage schema

### Turso tables

| Table | Key fields | Purpose | Isolation |
| :--- | :--- | :--- | :--- |
| `workspaces` | id, name, status | business boundary | top level |
| `members` | id, workspace_id, email, role_description | team | per workspace |
| `records` | id, workspace_id, type, data, version, archived_at | all facts | per workspace |
| `plans` | id, workspace_id, shape_hash, steps, trigger, confirmed_at, accuracy_score | compiled flows | per workspace |
| `runs` | id, workspace_id, plan_id, step_index, status | flow execution | per workspace |
| `events` | id, workspace_id, record_id, type, created_at | notifications | per workspace |
| `inbox_items` | id, workspace_id, member_id, event_id, reach, due_at, status | personal to-do | per member |
| `grants` | workspace_id, member_id, action, allowed | computed access | per member |

### Record types (in `records.data`)

| Type | States | Core fields | Limits |
| :--- | :--- | :--- | :--- |
| item | active, archived | name, unit, tax | - |
| variant | active, archived | item, sku, barcode, attributes | max 50 per item |
| price | active, archived | variant, amount, currency, channel, starts, ends | - |
| stock | active | variant, location, onhand, reserved | - |
| order | draft, accepted, fulfilled, cancelled | customer, lines, totals, channel | - |
| invoice | issued, partial, paid, void | party, order, lines, totals, due | - |
| payment | recorded, reversed | invoice, amount, method, provider, reference | - |
| refund | recorded | payment, amount, reason, reference | - |
| posting | posted | account, debit, credit, source | must balance |

### R2 storage (Cloudflare)

| Content | Storage | Reference |
| :--- | :--- | :--- |
| Product images | R2 | `records.data.image_key` |
| Invoice PDFs | R2 | `records.data.pdf_key` |
| Site artifacts | R2 release bucket | `sites.release_id` |
| Media > 2KB | R2 | `records.data.media_key` |

Rule: transactional facts (price, stock, invoice totals) never live only in R2.

## Action registry

116 registered actions. Each action:
- Has unique name (e.g., `order.create`)
- Declares reach: `none | data | customer | money`
- Declares inputs (typed)
- Validates before write
- Writes atomically
- Emits event
- Never callable without permission

| Action | Reach | Commits | Also writes |
| :--- | :--- | :--- | :--- |
| `order.create` | customer | order | stock reservation + event |
| `payment.record` | money | payment | posting (debit cash, credit receivable) + event |
| `invoice.issue` | money | invoice | posting (debit receivable, credit revenue) + event |
| `stock.adjust` | data | stock | event |
| `refund.record` | money | refund | posting (reverse) + event |

## Flow execution

```
PLAN (stored in Turso plans)
  trigger: tap | schedule | event
  steps: [
    { crud: "C", action: "order.create", gate: "auto", inputs: {...} },
    { crud: "R", action: "stock.read", gate: "auto" },
    { crud: "U", action: "stock.adjust", gate: "ask", approver: "assignee" }
  ]

RUN (stored in Turso runs)
  plan_id: 42
  step_index: 1  (current position)
  status: running | paused | completed | failed

EXECUTION
  1. Read plan from Turso
  2. For each step:
     a. Check gate (auto → execute, ask → wait for input, approve → wait for owner)
     b. Execute action (call registry)
     c. Write result
     d. Increment step_index
     e. If last step: mark run completed
```

### Gate logic

| Gate | Who | When | Override |
| :--- | :--- | :--- | :--- |
| auto | code | inputs known AND reach ∈ {none, data} | - |
| ask | assignee | input missing OR physical step | - |
| approve | owner/admin | money, customer, or over limit | always for money |

Safety floor: `auto + money → approve` (code enforced).

### Modifiers

| Modifier | Meaning | Limits |
| :--- | :--- | :--- |
| retry | run once more on failure | 3 attempts, backoff 2^n seconds |
| repeat | again until state changes, or per row | max 100 rows or 5 min timeout |
| undo | opposite posting | undo failure → owner approval |
| match | read two sources, update the match | - |

## Jev decision pipeline

```
WORDS: "send daily sales report at 10pm"
  |
  v
L0 LITERAL ──> exact match in literals.ts? ──> PLAN (0 calls)
  | no
  v
L1 MEMORY ───> shape_hash match in plans? ───> PLAN (0-1 calls)
  | no
  v
L2 PROSE (LLM) ──> extract: goal, trigger, step phrases ──> (1 call)
  |
  v
L3 DECIDE (Jev) ─> batch: tool, gate, modifier per step ─> (1 call)
  |
  v
L4 VERIFY (Jev) ─> batch: step needed? plan complete? ───> (1 call)
  |
  v
L5 CONFIRM (human) ──> owner approves ──> COMPILE ──> save to plans
  |
  v
RUN ──> 0 model calls, forever
```

### Jev signals

| Signal | Type | Use | Threshold |
| :--- | :--- | :--- | :--- |
| p(chosen) | probability | act if above | 0.60 (data), 0.80 (customer), 0.85 (money) |
| margin | p(top1) - p(top2) | ambiguous if small | 0.30 (data), 0.40 (customer), 0.50 (money) |
| confidence | concentration | detect spread | not used for decisions |

Adaptive: track accuracy per workspace, adjust thresholds.

### Batching

| Request | Questions | Calls | Cost |
| :--- | :---: | :---: | :--- |
| New flow | 1 LLM + 1 Jev (6-12 questions) | 2 | ~$0.02 |
| Known flow | 0 LLM + 0 Jev | 0 | $0 |
| Similar flow | 0 LLM + 1 Jev (1 question) | 1 | ~$0.001 |

13 questions in one Jev call: ~12× cheaper, ~10× faster than 13 separate calls.

## Inbox architecture

```
EVENT (workspace-wide)
  |
  v
FILTER ──> role + shift + reach ──> eligible members
  |
  v
INSERT inbox_items (one row per eligible member)
  |
  v
SORT (per member query)
  1. OVERDUE + high reach (money/customer first)
  2. DUE NOW + assigned to you
  3. DUE TODAY + you can act
  4. LATER + background alerts
```

### Inbox storage

| Field | Type | Purpose |
| :--- | :--- | :--- |
| workspace_id | uuid | isolation |
| member_id | uuid | who sees this |
| event_id | uuid | source event |
| reach | enum | money, customer, data, none |
| due_at | timestamp | when it's due |
| assigned_to | uuid | specific member or null |
| status | enum | pending, deferred, completed, archived |
| deferred_until | timestamp | when to show again |

### Actions

| Action | Effect |
| :--- | :--- |
| Complete | `status = completed`, write record if action required, archive |
| Defer | `status = deferred`, `deferred_until = now + interval` |
| Assign | `assigned_to = other_member_id` (owner/admin only) |

No delete. Events stay, marked archived, visible in history.

## Access control

```
MEMBER REQUEST
  |
  v
JEV ──> read role_description: "cashier, packs orders, no price edits"
  |     output: { job: "Cashier", grants: [...] }
  v
COMPUTE GRANTS ──> for each action:
  |                  if reach in [none, data] AND role allows → grant
  |                  if reach in [customer, money] AND role == owner → grant
  |                  else → deny
  v
WRITE grants table (workspace_id, member_id, action, allowed)
  |
  v
CARDS VISIBLE ──> for each card:
  |                 if any card action is granted → show
  |                 if card.reach > member reach → hide
  v
CANVAS (filtered by role + useful now)
```

| Role | Counter Sales | Cash Drawer | Revenue | Pricing | Store Studio | Team |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Owner | Full | Full | Full | Full | Full | Full |
| Admin | Full | Full | Full | Full | View | Hidden |
| Cashier | Execute | Shift only | Hidden | View only | Hidden | Hidden |
| Guest | Denied | Denied | Denied | Denied | Public view | Denied |

Full = see + act. Execute = act, no settings. View = see only. Shift only = act in shift. Hidden = not shown.

## Commerce kernel

```
BUY                                    SELL
supplier → purchase → receive → onhand
                                  |
customer → order → reserve → fulfill → invoice → payment → refund
                                  |
                            balanced postings
```

### Atomic commits

| Operation | Validates | Writes | Rollback if |
| :--- | :--- | :--- | :--- |
| order.create | prices active, stock available | order + stock reservation + event | any line unavailable |
| payment.record | invoice exists, amount ≤ due | payment + posting + event | balance mismatch |
| purchase.receive | quantities ≤ remaining | purchase update + stock increment + event | over-receipt |
| invoice.issue | order exists, not voided | invoice + posting + event | balance mismatch |

`validate_postings()` runs BEFORE commit. Balance mismatch → entire transaction rejected, nothing written.

### Posting rules

| Event | Debit | Credit |
| :--- | :--- | :--- |
| Sale | Cash / UPI | Revenue + Tax Payable |
| Payment received | Cash / Bank | Accounts Receivable |
| Purchase | Inventory / Expense | Accounts Payable |
| Refund | Revenue | Cash |

Every posting writes two records: one debit, one credit. Sum(debit) must equal sum(credit).

## Store generation

```
OWNER: "weave silk sarees, UPI + cash, ship nationwide, need store"
  |
  v
JEV #1 (business) ──> models: retail, apparel
  |                    industry: handloom
  |                    capabilities: catalog, booking, commerce
  v
CODE (shortlist) ───> filter designs by (retail, apparel) → 6 candidates
  |
  v
JEV #2 (look) ──────> design: luxury
  |                    recipes: header (brand), hero (commerce), catalog (grid), trust (proof)
  |                    spotlight: true (seasonal sale)
  v
CODE (assemble) ────> draft record
  |
  v
GATE ───────────────> missing: contact phone, booking service
  |                    ready: 42 items, hours, proof, spotlight
  |
  v
OWNER (fix) ────────> add contact, add booking service
  |                    record.created event
  v
GATE (recheck) ─────> all required present → draft complete
  |
  v
OWNER (publish) ────> write site release
  |                    compile pages to R2
  |                    update DNS
  v
LIVE (0 model calls per render)
```

### Site pages (generated once)

| Section | Recipe | Input | Output |
| :--- | :--- | :--- | :--- |
| Header | brand | workspace name, logo | nav + brand |
| Hero | commerce | lead, CTA | hero + button |
| Catalog | grid | active variants, prices | product grid |
| Trust | proof | certificates, reviews | trust badges |
| FAQ | disclosure | common questions | accordion |
| Footer | card | contact, hours, links | footer |

Each recipe: code template + data binding. No model at render.

## API structure

### Endpoints

| Path | Method | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `/cards` | GET | token | list cards for member |
| `/cards/:id` | GET | token | card detail + metrics |
| `/actions/:name` | POST | token | execute action |
| `/flows` | GET | token | list flows + active runs |
| `/flows/:id/run` | POST | token | start flow |
| `/runs/:id/step` | POST | token | advance run step |
| `/inbox` | GET | token | inbox items for member |
| `/inbox/:id/complete` | POST | token | mark item complete |
| `/store/draft` | GET | token | read draft |
| `/store/publish` | POST | token | publish draft |

### Request flow

```
CLIENT
  | POST /actions/order.create { lines, customer }
  v
GATEWAY (Cloudflare Worker)
  | validate token
  | extract workspace_id from token
  | rate limit check
  v
CORE API
  | find action in registry
  | check grant (workspace_id, member_id, "order.create")
  | validate inputs (schema)
  | execute action:
  |   read prices, stock
  |   compute lines, tax, total
  |   BEGIN TRANSACTION
  |     insert order
  |     update stock (reserve)
  |     insert postings
  |     insert event
  |   COMMIT
  | emit event to WebSocket
  v
RESPONSE { order_id, total, status: "accepted" }
```

## File structure (shipped)

```
tarharness/
├── src/
│   ├── actions/
│   │   ├── registry.ts         # 116 actions
│   │   ├── order.ts
│   │   ├── payment.ts
│   │   └── ...
│   ├── commerce/
│   │   ├── kernel.ts           # stock, price, posting logic
│   │   ├── validate.ts         # validate_postings()
│   │   └── atomic.ts           # transaction wrappers
│   ├── flows/
│   │   ├── runner.ts           # flow execution
│   │   ├── gate.ts             # gate logic
│   │   └── compiler.ts         # plan → executable
│   ├── cards/
│   │   ├── builder.ts          # card generation
│   │   └── metrics.ts          # metric reads
│   ├── inbox/
│   │   ├── filter.ts           # role filtering
│   │   └── sort.ts             # priority sorting
│   ├── access/
│   │   ├── grants.ts           # grant computation
│   │   └── roles.ts            # role parsing
│   ├── jev/
│   │   ├── client.ts           # Jev API calls
│   │   ├── batch.ts            # question batching
│   │   └── cache.ts            # response cache
│   └── db/
│       ├── turso.ts            # Turso client
│       └── schema.sql          # table definitions
└── test/
    └── commerce/               # 315 tests
```

## Deployment

| Component | Platform | Purpose |
| :--- | :--- | :--- |
| Core API | Cloudflare Workers | stateless, edge-deployed |
| Database | Turso (libSQL) | distributed SQLite, replicated |
| Storage | R2 (Cloudflare) | media, PDFs, site artifacts |
| WebSocket | Cloudflare Durable Objects | live sync |
| Client | Static (Cloudflare Pages) | PWA, mobile-first |

## Status

| Component | Status | Coverage |
| :--- | :--- | :--- |
| Commerce kernel | Shipped | 116 actions, 315 tests |
| Flow execution | Shipped | auto/manual gates |
| Card builder | Shipped | 18 tool cards |
| Access control | Shipped | Jev-derived grants |
| Inbox | Shipped | role-filtered, auto-sorted |
| Store generation | Shipped | 3 designs, 23 recipes |
| Jev integration | Shipped | 8 call sites, 7-day cache |
| Plan memory | Target | shape-based reuse |
| Flow modifiers | Target | retry, repeat, undo, match |
| Adaptive thresholds | Target | per-workspace accuracy tracking |

## Constraints

1. **Max 12 steps per flow** - cognitive load limit, transaction scope
2. **Max 50 variants per item** - prevents catalog explosion
3. **Max 3 retry attempts** - prevents infinite loops
4. **Max 100 rows per repeat** - prevents runaway batch jobs
5. **5 min timeout per flow** - prevents stuck runs
6. **2KB threshold for R2** - keeps transactional facts in DB
7. **Workspace isolation** - shared DB, `workspace_id` filter on every query
8. **No cross-workspace queries** - security and performance
9. **No model calls at runtime** - deterministic execution
10. **No table per trade** - one `records` table, `type` discriminator

## References

- Commerce actions: `tarharness/src/commerce/`
- Flow runner: `tarharness/src/flows/runner.ts`
- Action registry: `tarharness/src/actions/registry.ts`
- Jev client: `tarharness/src/jev/client.ts`
- Access control: `tarharness/src/access/grants.ts`
- Inbox logic: `tarharness/src/inbox/filter.ts`
