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

Many         = one user, many workspaces. each life keeps
               its own boundary. the switch is the list:
               a badge per row, one tap. no auto-switch,
               no merged inbox, no join.

Tool         = one merchant verb = a cluster of registered actions + reads
Action       = the only thing that writes. belongs to exactly one tool.
Card         = Tool x Role x Usefulness        -> what a member sees and taps
Flow         = Step + Step + ...               -> max 12
               composes existing actions only. a card shape, never a tool.
               its library lives behind the card.
Step         = Read + Action + Gate

Catalog      = Product + Service + Commodity   -> one tool, a `nature` field.
                                               rules differ, the tool does not.
Channel      = WhatsApp + Telegram + ...       -> one tool, adapters inside.
Stage        = a tag over tools (Business Manager). never a tool.

Card rule    = title, one number, one tap, right-aligned. at most one
               pending line.
               no chips, no second number, no url, no status.
               the number is chosen by role: money for the owner,
               counts for the member. everything else is a detail.
Card core    = the 14 basic tool cards, one per tool. the only
               menu. at birth Jev names the nature and code
               deals the cards. after, (+ Add a Card) browses
               it, zero model calls. every path writes the
               same one catalog record. nothing outside.
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
               no model on run. (the one law Memory, Site, and Onboard inherit)

Network      = phase 2. a member's agent orders from other workspaces:
               taxi, food, grocery. the order enters the merchant the
               same way as the web store: action + gate. each side keeps
               its own records. routing lives in control, never a join.
               the customer law holds across workspaces.
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
  move        every change ever. append-only. the event
              feed is a view over it: inbox + every canvas.
  current     the number now. derived, not duplicate. rebuildable.
  skill       memory of flow.
  run         one execution. a log, never a resume.
  inbox       each member's rows, typed by their tool.
  columns live in the Schema table below.

Bytes (R2)
              media, papers, sites, archive, closes
              DB = numbers, states, links. R2 = bytes.
              never only in R2: price, stock, totals, payment state.

Cost guard
              one write = record + move + current + inbox. one transaction.
              hot window 90 days -> monthly close, hash-sealed to R2 -> archive.
              current = close + bounded move.
              writes and models share the monthly ceiling.

Device       a window, never a copy. one door: the TAR API.
              the phone never touches a database. no sync, no
              mirror, no local-first, no database token.
              login   = one TAR session. the only credential
                        a phone ever holds.
              read    = GET /me: my workspaces + badge counts.
                        GET slice: my inbox rows + my cards'
                        numbers. kilobytes. a detail screen is
                        one more read, on tap.
              cache   = the last slice on disk. stale offline
                        is fine. the slice is disposable.
              write   = tap -> queue (idempotency key) ->
                        action -> gate. the phone sends
                        intent, never data.
              offline = reads: the cached slice. writes: taps
                        wait in the local queue, replay in
                        order. a badge tells the truth.
              grant   = the server grants the slice. the
                        phone never picks its own.
                        the size of the slice is trust.
                        the road for writes is one.

Realtime     freshness in layers. the bell is never the data.
              own tap = the answer returns the fresh slice.
              open app = a 20s version check: if-none-match
              on the last move id. 304 = nothing changed.
              nearly free at any scale.
              closed phone = OS push (FCM / APNs). the only
              bell that reaches a pocket. the driver's road.
              instant = later. a CF websocket hub, opened on
              demand. the poll is the floor.

Plug         the DB is a plug behind the API. today Turso.
              if bills ever grow: our servers + SQLite
              files. laws unchanged. files copy.
```

## Schema (10 tables, the floor)

| DB | Table | Columns | Holds |
| :--- | :--- | :--- | :--- |
| D1 | user | id, email, name | who exists |
| D1 | workspace | id, name, slug, mode, db, host, state | one business boundary |
| D1 | member | workspace, user, role, state | who belongs where |
| D1 | invite | workspace, email, role, state | pending members |
| Turso | record | id, type, data, version, owner, created, archived | every fact. data under 2KB |
| Turso | move | id, kind, record, key, amount, why, source, created | every change. append-only. events are a view over it |
| Turso | current | kind, key, data | the number now. key = kind + key |
| Turso | skill | id, shape, trigger, steps, score, confirmed | memory of flow. embedding later |
| Turso | run | id, skill, step, status, key, input | one execution. same key never twice |
| Turso | inbox | id, member, move, tool, reach, due, assigned, status | each member's rows, typed by tool |

One schema, two modes: `workspace.mode = personal | work`. Personal is a workspace of one; its slice is the whole DB. It graduates to work in place. Ten tables is the floor; each has exactly one job.

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

## Shapes - the detail behind a card

```
Shape        = four, not fourteen. the tool is a row in the
               registry, never a file.

               list      one route. queue, bills, receipts,
                         cash, items, stock, po, pos,
                         expenses, contacts, members, tasks.
                         rows + the number + the one tap.
               sale      one route. pos. invoice is sale in
                         gst mode.
               chat      one route. channel. the one shape
                         earned, never assumed.
               sheet     one form, many configs. receipt,
                         cash, item, stock, po, expense,
                         contact. fields from the registry.
               site      no screen. view store is a url.

               row tap   one record detail. any tool. read +
                         status. the fourth shape.

               a new tool is an entry, not a screen. a new
               screen is earned by a new shape, and only
               that. the branch lives in data, never code.

 the files (six routes, one sheet, one registry):

 src/
   screens/
     Canvas.tsx        the app
     Ask.tsx           the agent
     ToolList.tsx      /tool/:toolId        12 tools
     Sale.tsx          pos + invoice        gst mode
     Chat.tsx          channel
     RecordDetail.tsx  /record/:id          any row tap
   components/
     ActionSheet.tsx   one form sheet, config-driven
     Card.tsx
   tools/
     registry.ts       the file that makes 14 = 4
```

## Canvas - one screen, every member (concept)

```
   OWNER - alerts, money, site           MEMBER - own tools, own tasks
 +----------------------------------+  +----------------------------------+
 | 9:41                         94%|  | 16:12                          76%|
 +----------------------------------+  +----------------------------------+
 | (3) Aambal Neyvagam           (o)|  | (2) Aambal Neyvagam          (o) |
 | Owner                            |  | Cashier - Shift 14               |
 +----------------------------------+  +----------------------------------+
 | ! NEXT  Cash drawer out Rs. 350  |  | NEXT  Pack parcel, 2 items       |
 |                         [ Audit ]|  |                      [ Complete ]|
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
 | every day 10am send me the       |
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
 THE WAY IN - three cases, one confirm, one surface

   CREATE a sentence . JOIN an invite . GROW a fact
                        |
                        v
                  [ ASK ] --- one confirm ---> [ CANVAS ]

   before the first card, Ask is the app. after one
   confirm, Canvas is. words change the plan.
   the confirm stays one.

   CREATE  words. Jev names the nature, code deals
           the cards. Site Mode 1's law.
   JOIN    one card, one tap, zero model calls. one
           member row. grants choose the stack.
   GROW    a mode change, not a migration. code sees
           the fact, code proposes. no LLM. never silent.

 THE SPLIT - the LLM proposes. Jev types. the action writes.

   words . photos . exports
        |
        v
      LLM --draft--> JEV --plan--> ACTION + gate

   LLM     proposes only, never writes. words, any
           language. photos, excel, pos exports.
   JEV     types only, never prose. one call, many
           verdicts, in parallel.
   ACTION  writes it, behind a gate.

   no model after birth. the stack runs free.

 THE VERDICTS - one Jev call, four answers, in parallel

   nature   choice   food 0.92 | shop 0.05 | service 0.02
                     the spread deals the cards: top
                     natures take their recipes.
   role     choice   owner | admin | cashier, straight
                     from the owner's words.
   rows     noul     one per row: price sane? code valid?
   risk     noul     test? abuse? the create gate.

   Jev speaks three times: at birth (nature + risk),
   at import (rows), at hire (role). nowhere else.
   a noul near one half is doubt, not a middle answer.
   doubt escalates to the one confirm.

 BIRTH - one confirm, one control action, idempotent

   [ the one confirm ]
        |
        v
   D1       workspace + owner
   TURSO    10 tables, nothing else
   R2       an empty layout

   a draft lives in the conversation, never in control.
   a failed or abandoned birth leaves nothing.
   not a tool: control actions, same registry, same
   gate. 14 tools stay 14. no new tables.
   slug from the name, collisions get a number.
   locale gives currency, tax, words.
   the recipe seeds the first inbox. birth ends on
   a Canvas with a NEXT, never a blank.

 MANAGE - a conversation, not a settings screen

   members, roles, shifts   ->  the member card
   name, mode, url, danger  ->  ASK

   the owner is the gate. archive and transfer ask
   twice. archived is a state: records are never
   deleted. workspaces never merge.
```

```
 1  FIRST - the empty door.            2  INVITED - the invite card.
 +----------------------------------+  +----------------------------------+
 |  TAR                             |  |  TAR                             |
 |                                  |  |                                  |
 |  tell TAR about your business    |  |  Aambal Neyvagam                 |
 |  in one line                     |  |  invites you as                  |
 |                                  |  |  Cashier                         |
 |   [ I have a price list ]        |  |                                  |
 |   [ I have an invite ]           |  |                                  |
 |                                  |  |                     [ Join ]     |
 +----------------------------------+  +----------------------------------+

 3  PLAN - one sentence, a typed plan.  4  THE PICK - the menu, marked.
 +----------------------------------+  +----------------------------------+
 |  < TAR                           |  |                                  |
 +----------------------------------+  |  CARD CORE                  14   |
 | You                              |  |                                  |
 | tea shop. snacks to go. just me. |  |  [*] Counter Sales        money  |
 | TAR                              |  |  [*] Products + Prices    data   |
 | PLAN    Create workspace         |  |  [*] Daily Expenses       money  |
 | name    Aambal Tea Stall         |  |  [ ] Orders and Dispatch  cust   |
 | nature  food counter      jev .92|  |  [ ] Online Storefront    cust   |
 | cards   3 of 14, from the core   |  |  [ ] 9 more deferred             |
 | money   Rs . GST 5% . UPI        |  |                                  |
 | site    aambal-tea.tar.site      |  |                                  |
 |       [ Confirm ]   [ Change ]   |  |                                  |
 +----------------------------------+  +----------------------------------+
   the recipe marked 3. tap any card to toggle it.

 5  FIRST CANVAS - what one sentence bought.
 +----------------------------------+
 | (1) Aambal Tea Stall            o|
 | Owner                            |
 +----------------------------------+
 | NEXT  add your first item        |
 |                    [ Add Item ]  |
 +----------------------------------+
 | COUNTER SALES                    |
 | Rs. 0 today                      |
 |                      [ New Sale ]|
 +----------------------------------+
 | PRODUCTS AND PRICES              |
 | 0 items                          |
 |                      [ Add Item ]|
 +----------------------------------+
 | DAILY EXPENSES                   |
 | Rs. 0 today                      |
 |                   [ Log Expense ]|
 +----------------------------------+
 |                 [ + Add a Card ] |
 +----------------------------------+
 |                              (+) |
 +----------------------------------+

 6  IMPORT - a photo becomes rows.     7  GROW - a hire is a fact.
 +----------------------------------+  +----------------------------------+
 |  < TAR                           |  |  < TAR                           |
 +----------------------------------+  +----------------------------------+
 | You                              |  | You (owner)                      |
 | (photo of a price list)          |  | hire Ravi for the morning counter|
 | TAR                              |  | TAR                              |
 | DRAFT   14 rows from the photo   |  | PLAN    Add member               |
 |   1  chai            Rs. 10 .98  |  | Ravi    cashier . shift 6 to 10  |
 |   2  filter coffee  Rs. 15 .98   |  | more    a second member makes    |
 |   3  samosa ?       Rs. ?? .51   |  |         this work mode           |
 | row 3 is doubt. fix or post 13.  |  |       [ Confirm ]   [ Change ]   |
 |    [ Fix row 3 ]  [ Post 13 ]    |  |                                  |
 +----------------------------------+  +----------------------------------+

 8  MANY - one user, many boundaries.
 +----------------------------------+
 |  TAR                             |
 |                                  |
 |  Personal              you       |
 |  Aambal Neyvagam       Cashier   |
 |  Home Foods            Admin     |
 |                                  |
 +----------------------------------+
```

Five maps hold the laws, eight screens walk them.
one surface the whole way: no workspace to first sale.

