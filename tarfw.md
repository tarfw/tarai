# TAR - Tools, Flows, Cards

## Concept

```
TAR         = Architecture + Tools + Cards

Architecture = Turso (records) + R2 (files) + Action Registry
             + Events + Gates + Inbox engine + Adapters
             invisible. nobody taps a database.

User         = a member of a workspace. the app is members only.
Workspace    = owner + admin + cashier + ...   -> one business boundary
Merchant     = the owner. the first member.
Customer     = storefront only. never a member.

Tool         = one merchant verb = a cluster of registered actions + reads
Action       = the only thing that writes. belongs to exactly one tool.
Card         = Tool x Role x Usefulness        -> what a member sees and taps
Flow         = Step + Step + ...               -> max 12
               composes existing actions only. a card shape, never a tool.
               its library lives behind the card.
Step         = CRUD + Action + Gate + Modifier

Catalog      = Product + Service + Commodity   -> one tool, a `nature` field.
                                               rules differ, the tool does not.
Channel      = WhatsApp + Telegram + ...       -> one tool, adapters inside.
Stage        = a tag over tools (Business Manager). never a tool.

Card rule    = title, one number, one tap, right-aligned. at most one
               pending line.
               no chips, no second number, no url, no status.
               the number is chosen by role: money for the owner,
               counts for the member. everything else is a detail.
Add card     = the button browses the catalog. zero model calls.
               the agent takes intent. both write the same one record.
NEXT         = the top inbox row. urgent rows carry !.
               there is no alert strip. an alert is just the top row.
Inbox        = a property of every card, not a place. rows typed by tool.
               the badge opens the flat view of them all. never a tool.
Surface      = one screen, no tabs. Canvas is the app.
               circle badge = the flat inbox.
               avatar = a big plain circle. it is You.
               the header ends in a hairline. header type is one step
               smaller and muted. chrome, never a card. cards stay on
               paper, separated by whitespace only.
               the floating (+) = the agent, fullscreen.
               every other screen is a detail of a card.
Ask          = the personal agent, fullscreen. one long conversation.
               yours alone: it sees only what your grants allow.
               in personal it is open to all your own data.
               words -> plan -> one confirm -> skill -> card.
               it proposes plans from registered actions only. never
               freelances. money or customer always asks first.
               cards can be made here: your own on one confirm.
               another member's only if you are the owner or admin.

Integration  = adapter -> registered action -> one of the 14 tools
               built and reviewed at build time, never found at runtime.
               no model on run. (the one law Memory and Site inherit)

Network      = phase 2. a member's agent orders from other workspaces:
               taxi, food, grocery. the order enters the merchant the
               same way as the web store: action + gate. each side keeps
               its own records. routing lives in control, never a join.
               the consumer is never a member of the merchant workspace.
               settlement across workspaces is the one new design.

Site         = one tool, two modes, one door.

               Mode 1  CURATED   describe once -> Jev picks design + recipes.
               Mode 2  SANDBOX   member prompts -> LLM writes Astro code.
                                 built in an isolated box.          (later)

                    |                        |
                    +----> release in R2 <---+
                               |
               ONE sites worker serves *.tar.site
               subdomain -> workspace -> release
                               |
               gate -> publish = an immutable release. rollback repoints.

               the LLM writes looks. never checkout, payment, tax, price, stock.
               the workspace owns the URL. the mode can change, the URL does not.
               sandbox, builder, releases = architecture.
```

Rules that follow:

- A flow composes existing actions only. It never invents a step.
- A tool with no core flow (sell, buy, close day) is deferred, not built.

## Tool list (14)

| # | Tool | Card | Reach | One tap |
| :-: | :--- | :--- | :--- | :--- |
| 1 | pos | Counter Sales | money | New Sale |
| 2 | order | Orders and Dispatch | customer | Open Queue |
| 3 | invoice | Billing and GST | money | Issue Bill |
| 4 | payment | Payments and UPI | money | Record Receipt |
| 5 | register | Cash Drawer | money | Count Cash |
| 6 | catalog | Products and Prices | data | Add Item |
| 7 | stock | Inventory and Warehouse | data | Adjust Stock |
| 8 | purchase | Supplier POs and GRN | money | New PO |
| 9 | expense | Daily Expenses | money | Log Expense |
| 10 | contact | Customers and Leads | customer | Add Contact |
| 11 | member | Team and Shifts | data | Manage Members |
| 12 | site | Online Storefront | customer | View Store |
| 13 | task | Manual Tasks | none | Mark Done |
| 14 | channel | Messages | customer | Open Chat |

## Canvas - one screen, every member (concept)

```
   OWNER - alerts, money, site           MEMBER - own tools, own tasks
 +----------------------------------+  +----------------------------------+
 | 9:41                          94%|  | 16:12                          76%|
 +----------------------------------+  +----------------------------------+
 | (3) Aambal Neyvagam           (o)|  | (2) Aambal Neyvagam          (o) |
 | Owner                            |  | Cashier - Shift 14               |
 +----------------------------------+  +----------------------------------+
 | ! NEXT  Cash drawer out Rs. 350  |  | NEXT  Pack parcel, 2 items       |
 |                        [ Audit ]|  |                  [ Complete ]|
 +----------------------------------+  +----------------------------------+
 | COUNTER SALES                    |  | COUNTER SALES                    |
 | Rs. 18,450 today                 |  | 9 bills today                    |
 |                      [ New Sale ]|  |                      [ New Sale ]|
 +----------------------------------+  +----------------------------------+
 | ORDERS                           |  | ORDER PACKING                    |
 | 3 to pack                        |  | 2 to pack                        |
 |                    [ Open Queue ]|  |                 [ Start Packing ]|
 +----------------------------------+  +----------------------------------+
 | ONLINE STORE                     |  | SHIFT HANDOVER                   |
 | 142 visits today                 |  | 16:00                            |
 |                    [ View Store ]|  |                [ Start Handover ]|
 +----------------------------------+  |                                  |
 |                 [ + Add a Card ] |  |                                  |
 +----------------------------------+  |                                  |
 |                              (+) |  |                              (+) |
 +----------------------------------+  +----------------------------------+

   ASK - words become skills (the (+), fullscreen)
 +----------------------------------+
 | < TAR                            |
 +----------------------------------+
 | You                              |
 | every day 10am send me the      |
 | sales report                     |
 | TAR                              |
 | PLAN   Daily Sales Report        |
 | 1. read sales at 10:00           |
 | 2. send it to you on WhatsApp    |
 | every day. confirm once and it   |
 | runs free forever.               |
 |       [ Confirm ]   [ Change ]   |
 | You                              |
 | confirm                          |
 | TAR                              |
 | saved as a skill. the card is    |
 | on your Canvas. first run        |
 | tomorrow 10:00.                  |
 |                                  |
 |                                  |
 |                                  |
 |                                  |
 |  ask TAR anything...      [send] |
 +----------------------------------+
```

Three screens, one app: the owner's Canvas, the member's Canvas, the agent.
Same screen for every member - grants change the stack, not the layout.
The laws live in Concept: Card rule, NEXT, Surface, Ask.

## Data

```
Memory       = skills. describe once -> run forever, free.
               L0 literal -> L1 shape -> L2 prose -> confirmed skill.
               vector = one column on skill. added only when L1 misses climb.

Control (D1, platform-wide)
               who exists, who belongs where. columns in Schema.

Truth (one Turso DB per workspace)
  record      every fact. versioned, archived.
  move        every change ever. append-only.
  current     the number now. derived, not duplicate. rebuildable.
  skill       memory of flow.
  run         one execution. resume from step.
  event       what happened. feeds inbox + every canvas.
  inbox       each member's rows, typed by their tool.
  columns live in the Schema table below.

Bytes (R2)
              media, papers, sites, archive, closes
              DB = numbers, states, links. R2 = bytes.
              never only in R2: price, stock, totals, payment state.

Cost guard
              one write = record + move + current + event. one transaction.
              hot window 90 days -> monthly close, hash-sealed to R2 -> archive.
              current = close + bounded move.
              writes and models share the monthly ceiling.

Device       a window, never a copy.
              read    = granted projections. a card's slice = metrics + its inbox rows.
              write   = tap -> queue (idempotency key) -> registry -> gate.
                        one road. every role.
              mirror  = personal DB only: small, own data, local-first.
              offline = cached cards + queued taps. a syncing badge tells the truth.
              package = @tursodatabase/sync-react-native, pinned. pull only.
                        push() is never a road: it skips gates and postings.
              roles   = owner, admin -> projections, more of them
                        member -> projections, their slice
                        personal -> the mirror
                        customer -> R2 site pages
              the size of the window is trust. the road for writes is one.
```

## Schema (11 tables, the floor)

| DB | Table | Columns | Holds |
| :--- | :--- | :--- | :--- |
| D1 | user | id, email, name | who exists |
| D1 | workspace | id, name, slug, mode, db, host, state | one business boundary |
| D1 | member | workspace, user, role, state | who belongs where |
| D1 | invite | workspace, email, role, state | pending members |
| Turso | record | id, type, data, version, owner, created, archived | every fact. data under 2KB |
| Turso | move | id, kind, key, amount, why, source, created | every change. append-only |
| Turso | current | kind, key, data | the number now. key = kind + key |
| Turso | skill | id, shape, trigger, steps, score, confirmed | memory of flow. embedding later |
| Turso | run | id, skill, step, status, key, input | one execution. same key never twice |
| Turso | event | id, record, type, created | what happened. feeds inbox + canvas |
| Turso | inbox | id, member, event, tool, reach, due, assigned, status | each member's rows, typed by tool |

One schema, two modes: `workspace.mode = personal | work`. Personal graduates to a business by a mode change, not a migration. Eleven tables is the floor; each has exactly one job.

