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

               ONE sites worker serves *.tar.site
               subdomain -> workspace -> release in R2
               gate -> publish = an immutable release. rollback repoints.

               the LLM writes looks. never checkout, payment, tax, price, stock.
               the workspace owns the URL. the mode can change, the URL does not.
               sandbox, builder, releases = architecture.
```

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

## Tool list (14)

A tool with no core flow (sell, buy, close day) is deferred, not built.

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

## Onboarding - create, join, manage on one surface (concept)

```
Onboard       = the way in, then the way it is run. three cases,
               one surface: Ask. before the first card, Ask is
               the app. after the first confirm, Canvas is.

Case 1  CREATE  fresh merchant, no workspace. one sentence
               describes the business.
               describe once -> Jev picks the stack.
               the same law Site Mode 1 follows.
               words change the plan. still one confirm.
Case 2  JOIN    invited member. no creation. one card, one tap,
               zero model calls. join writes one member row.
               the stack comes from grants, never choice.
Case 3  GROW    personal -> work. a mode change, not a migration.
               code watches the facts. Jev judges the meaning.
               it proposes, never silent. one confirm.

Split         = the LLM proposes. Jev types. the action writes.
               LLM     words, any language -> a draft. photos of
                       price lists, excel, old pos exports ->
                       draft rows. it never writes.
               Jev     typed verdicts, never prose. one call,
                       many verdicts, in parallel:
                         nature   choice. shop | food | service
                                  | mixed. the spread names the
                                  runner up.
                         stack    choice among recipes in code.
                                  Jev selects, never invents.
                         role     choice. owner | admin |
                                  cashier | ... from words.
                         rows     noul, one per row: price
                                  sane, code valid.
                         risk     noul per label: duplicate,
                                  test, abuse. the create gate.
               a noul near one half is doubt, not a middle
               answer. doubt escalates to the one confirm.
               no model after birth. the stack runs free.
               (the law Integration set, inherited at birth.)

Provision     = one confirm -> one control action, idempotent:
                 D1     workspace + member (owner). state active
                 Turso  a fresh DB. 11 tables. nothing else.
                 R2     an empty layout.
               a draft lives in the conversation, never in
               control. a failed provision leaves nothing. an
               abandoned one leaves nothing.
               creation is not a tool. it is the door: control
               actions in the same registry, writing D1, behind
               the same gate. 14 tools stay 14. no new tables.
               slug from the name, collisions get a number.
               locale gives currency, tax, words.

Manage        = a conversation, not a settings screen.
               members, roles, shifts  -> the member card.
               name, mode, url, danger -> Ask -> plan -> one
               confirm -> control action. the owner is the gate.
               archive and transfer ask twice. archived is a
               state: records are never deleted.
               many workspaces: the door lists them. one tap
               enters. workspaces never merge.
```

```
   CREATE - no workspace yet. Ask is the whole app.
 +----------------------------------+
 |  TAR                             |
 |                                  |
 |  tell TAR about your business    |
 |  in one line                     |
 |                                  |
 |   [ I have a price list ]        |
 |   [ I have an invite ]           |
 |                                  |
 +----------------------------------+

 You
 tea shop. snacks to take away. just me.
 TAR
 PLAN    Create workspace
 name    Aambal Tea Stall
 nature  food counter                 jev 0.92
 cards   Counter Sales, Products and
         Prices, Daily Expenses
 money   Rs . GST 5% . UPI            from locale
 site    aambal-tea.tar.site          ready
       [ Confirm ]   [ Change ]

   JOIN - invited. one card, one tap, zero model calls
 +----------------------------------+
 |  TAR                             |
 |                                  |
 |  Aambal Neyvagam                 |
 |  invites you as Cashier          |
 |                                  |
 |                     [ Join ]     |
 +----------------------------------+

   GROW - personal becomes work. manage is the same talk.
 You (owner)
 hire Ravi for the morning counter
 TAR
 PLAN    Add member
 Ravi    cashier . shift 6 to 10
 more    a second member promotes your
         workspace to work mode
       [ Confirm ]   [ Change ]
```

Three cases, one surface: no wizard, no form, no settings screen.
Onboarding is Ask before the first card, management is Ask after it.
Inherited: Integration (no model on run), Gate (asks first), Card
(one tap). The floor holds: 11 tables, 14 tools.

