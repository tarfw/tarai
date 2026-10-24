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
Card         = Tool x Role x Usefulness        -> what a member sees and taps
Flow         = Step + Step + ...               -> max 12
Step         = CRUD + Action + Gate + Modifier
Action       = the only thing that writes. belongs to exactly one tool.

Catalog      = Product + Service + Commodity   -> one tool, a `nature` field.
                                               rules differ, the tool does not.
Channel      = WhatsApp + Telegram + ...       -> one tool, adapters inside.
Stage        = a tag over tools (Business Manager). never a tool.
Inbox, Flow  = surfaces and card shapes. never tools.

Integration  = adapter -> registered action -> one of the 14 tools
               built and reviewed at build time, never found at runtime.
               no model on run. (the one law Memory and Site inherit)

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
               gate -> publish tap -> rollback tap
               publish writes an immutable release. rollback repoints.

               the LLM writes looks. never checkout, payment, tax, price, stock.
               the workspace owns the URL. the mode can change, the URL does not.
               sandbox, builder, releases = architecture. the tool stays one.
```

Rules that follow:

- A flow composes existing actions only. It never invents a step.
- Every write = one registered action + gate + idempotency. No other path.
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
   OWNER - alerts, money, site        MEMBER - own tools, inbox, shift
 +--------------------------------+  +--------------------------------+
 | 9:41                      94%  |  | 16:12                    76%  |
 +--------------------------------+  +--------------------------------+
 | Aambal Neyvagam         Owner |  | Aambal Neyvagam   Kanimozhi   |
 | ! Cash drawer out Rs. 350  >  |  | Cashier - Shift 14            |
 +--------------------------------+  +--------------------------------+
 | NEXT  Pack order 42   due 15m |  | NEXT  Pack parcel, 2 items    |
 |                    [ Complete ]|  |                [ Complete ]   |
 +--------------------------------+  +--------------------------------+
 | COUNTER SALES         SHIFT 14 |  | COUNTER SALES         SHIFT 14 |
 | Today Rs. 18,450    14 bills  |  | Bills 9       Drawer Rs. 4,350 |
 | [ New Sale ]                  |  | [ New Sale ]                  |
 +--------------------------------+  +--------------------------------+
 | ORDERS   Pending 3  Shipped 11|  | INBOX    2 waiting, 1 overdue |
 | [ Open Queue ]                |  | [ Open Feed ]                 |
 +--------------------------------+  +--------------------------------+
 | SITE  aambal.tar.site    LIVE  |  | SHIFT HANDOVER        16:00   |
 | Visits 142     [ View Store ] |  | Not started                   |
 | [ + Add a Card ]              |  | [ Start Handover ]            |
 +--------------------------------+  +--------------------------------+
 | Ask TAR anything...        (+)|  | Ask TAR anything...        (+)|
 | (+)  [Canvas] Flows Site You  |  | (+)  [Canvas] Flows      You  |
 +--------------------------------+  +--------------------------------+
```

One screen, one stack: alert, next, then only the cards this member may use now.
Grants build the stack. The owner gets alerts, site and add-card. The member
gets their tools, their inbox and their shift. The member's bar has no Site.
Every card is a saved read + one tap.

## Data

```
Memory       = skills. describe once -> run forever, free.
               L0 literal -> L1 shape -> L2 prose -> confirmed skill.
               vector = one column on skill. added only when L1 misses climb.

Control (D1, platform-wide)
               user, workspace, member, invite

Truth (one Turso DB per workspace)
  record      every fact. versioned, archived.
  move        every change ever. append-only.
  current     the number now. derived, not duplicate. rebuildable.
  skill       memory of flow.
  run         one execution. resume from step.
  event       what happened. feeds inbox + every canvas.
  inbox       each member's to-act rows.
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
```

## Schema (11 tables, the floor)

| DB | Table | Columns | Holds |
| :--- | :--- | :--- | :--- |
| D1 | user | id, email, name | who exists |
| D1 | workspace | id, name, slug, mode, db, host, state | one business, one Turso DB |
| D1 | member | workspace, user, role, state | who belongs where |
| D1 | invite | workspace, email, role, state | pending members |
| Turso | record | id, type, data, version, owner, created, archived | every fact. data under 2KB |
| Turso | move | id, kind, key, amount, why, source, created | every change. append-only |
| Turso | current | kind, key, data | the number now. key = kind + key |
| Turso | skill | id, shape, trigger, steps, score, confirmed | memory of flow. embedding later |
| Turso | run | id, skill, step, status, key, input | one execution. same key never twice |
| Turso | event | id, record, type, created | what happened. feeds inbox + canvas |
| Turso | inbox | id, member, event, reach, due, assigned, status | each member's to-act rows |

Rechecked once for simplification: `current` can't fold into record (bounded hot cache, natural key), `inbox` can't fold into event (per-member rows), `run` can't fold into skill (many runs per skill). Eleven tables is the floor; each has exactly one job.

