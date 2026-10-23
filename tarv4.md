# TAR v4 - One Canvas OS

> Merchant describes the business once. The system puts the right cards on the Canvas.
> Every card is a saved read + one tap. Every tap writes one record. No model at render or run.

```
WORDS or TAP -> PLAN (LLM sketch + JEV pick + CODE wire) -> CARD -> GATE -> ONE RECORD -> EVERY CARD SYNC
```

| Part | Holds |
| :--- | :--- |
| A | Concept: words, kernel nouns, lanes, card, flow, access, Jev, ladder, cost, commerce, status |
| B | Concept screens: canvas, card, flow, checkout, store, manager, inbox |
| C | The store: models, designs, recipes, gate |
| D | Three traces, lane by lane |
| E | Edge decisions |
| F | Flow library: one full trace, 45 domain flows, shape map, boundary |

---

# PART A - CONCEPT

## A1. The idea

```
                    BEFORE                                                 AFTER
 +--------------------------------------------+        +--------------------------------------------+
 | 9:41                                   94% |        | 9:41                                   94% |
 +--------------------------------------------+        +--------------------------------------------+
 | 18 tools                          NO GUIDE |        | Aambal Neyvagam                      Owner |
 +--------------------------------------------+        +--------------------------------------------+
 | Search 18 tools...                         |        | COUNTER SALES                     SHIFT 14 |
 +--------------------------------------------+        | Today Rs. 18,450  UPI Rs. 14,100           |
 | [ POS      ] [ ORDER    ] [ ITEM     ]     |        | 14 bills, drawer cash Rs. 4,350            |
 | [ REGISTER ] [ STOCK    ] [ INVOICE  ]     |  -->   | [ New Counter Sale ]                       |
 | [ PAYMENT  ] [ EXPENSE  ] [ PURCHASE ]     |        +--------------------------------------------+
 | [ TEAM     ] [ CONTACT  ] [ TASKS    ]     |        | ORDERS AND FULFILMENT                      |
 | [ FLOWS    ] [ STORE    ] [ INBOX    ]     |        | Pending 3   Dispatched today 11            |
 | [ CHAT     ] [ WHATSAPP ] [ TELEGRAM ]     |        | [ Open Queue ]                             |
 +--------------------------------------------+        +--------------------------------------------+
 | Tap the right tool.                        |        | [ + Add a Card ]                           |
 | Remember the steps.                        |        | Message TAR...                         (+) |
 |  (+)    [ Tools ]    Flows    Site    You  |        |  (+)    [Canvas]    Flows    Site    You   |
 +--------------------------------------------+        +--------------------------------------------+
  18 tool icons                                          only your cards
  everyone needs training                                zero training, one tap
```

```
 SEVEN LAWS
   1  Every event writes balanced debit / credit
   2  Stock never negative: available = on hand - reserved
   3  Nothing erased. Archive only, log who / when / what
   4  One registry. New trade = new action + new record type, never a table
   5  Money or customer needs one confirm
   6  Every owner tap has one-tap undo
   7  No model on run. Cards and runs are deterministic
```

## A2. Seven words

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, cards, site, shared Turso DB with workspace_id | Aambal Neyvagam, Salem |
| Canvas | Home stack, only cards allowed for you, useful now | Cashier 4, owner 6 |
| Card | Saved read + one tap | Cash Drawer: Rs 4,350 + [Count] |
| Flow | Ordered resumable steps, max 12 | Evening Closing, 4 steps |
| Step | One existing tool call (CRUD) | count cash drawer |
| Record | Typed row in the one records table | item, stock, order, posting |
| Inbox | Personal to-act feed, mandatory per member | 2 waiting, 1 overdue |

```
CARD = saved read + one tap
  2 shapes: action | flow
  card = { title, metrics: [{ label, read }], action, reach }

TAP -> GATE -> ONE RECORD -> EVENT -> INBOX -> EVERY CANVAS
```

These seven are the surface words. The kernel nouns below are the implementation terms;
`Trigger`, `Gate`, `Approver`, `Modifier` live inside Flow only.

| Kernel noun | Meaning | Example |
| :--- | :--- | :--- |
| Tool card | A card backed by one action. 18 of them | Counter Sales |
| Run | One execution of a flow | Run 104, step 2 of 4 |
| Action | The only thing that writes. 116 registered | order.create |
| Stage | A tag that groups actions for the manager. 14 of them | Sell, Money, People |
| Posting | Balanced debit and credit written with a record | sale: debit cash, credit revenue |
| Role | What a member does. Jev reads it from plain English | Cashier |
| Reach | Risk of an action: money, customer, data, none | money |
| Memory | A confirmed plan stored in Turso `plans` table, reused later | daily report pattern |

## A3. Four lanes

| Lane | Owns | Never |
| :--- | :--- | :--- |
| Code | numbers, money, counts, dates, gates, grants | asks a model for a derivable fact |
| Jev | which of N, how risky, how useful | prose, computes, grants, commits |
| LLM | the words, the layout, the prose | picks ids, decides, computes |
| Code | the commit, always | anything a model influences |

A lane never crosses.

```
 WORDS or TAP
      |
      v
   PLAN    LLM sketches, JEV picks, CODE wires
      |
      v
   CARD
      |
      v
   GATE    token, grant, version, idempotency
      |
      v
   RECORD  one row, then every card syncs
```

## A4. One kernel

```
 C create -> one new record
 R read   -> count, sum, list, report   (projections are read-only)
 U update -> one new version of a record
 D delete -> archive (never erase)
```

| Record | Writes | Also writes |
| :--- | :--- | :--- |
| sale | order + invoice + payment | posting (debit cash / credit revenue) + stock |
| expense | expense | posting |
| stock move | inventory | - |
| member | member | - |
| flow run | run + step pointer | - |

```
 P&L, GST, forecast, stock on hand: computed by CODE from records.
 LLM never computes. JEV never computes.
```

## A5. Cards

```
 +----------------------------------------+
 | [icon] Counter Sales           [SHIFT] |
 | Today Rs 18,450  UPI 14,100            |
 | 14 bills, drawer cash Rs 4,350         |
 | [ New Counter Sale ]                   |
 +----------------------------------------+
   Tap title  -> detail (list / search / detail)
   Tap button -> commit once (gate -> one record)
   Other actions live in detail
```

| Preset | Shape | Opens | Example |
| :--- | :--- | :--- | :--- |
| tool | action | list, search, detail | Products, Stock |
| flow | flow | checklist run | Evening Closing |
| site | action | store preview + edit | Online Store |
| channel | action / read | feed or chat | WhatsApp, Telegram |
| human | action | task list | Manual Tasks |

| Surface | Holds |
| :--- | :--- |
| Canvas | Home stack: allowed + useful cards |
| Flows | Active runs + available flows |
| Site | Storefront preview, edit, publish |
| You | Profile, settings, workspaces |
| Inbox | Personal to-act feed (mandatory) |

| Tool | Card | Reach | Glance | One tap |
| :--- | :--- | :--- | :--- | :--- |
| pos | Counter Sales | money | cart, bills today | New Counter Sale |
| register | Cash Drawer | money | cash on hand | Count Cash |
| item | Products and Prices | data | active SKUs | Add Product |
| inventory | Stock and Warehouse | data | units, low stock | Adjust Stock |
| order | Orders and Dispatch | customer | to pack, shipped | Open Queue |
| invoice | Billing and GST | money | receivables | Issue Bill |
| payment | Payments and UPI | money | UPI today | Record Receipt |
| expense | Daily Expenses | money | petty cash spent | Log Expense |
| purchase | Supplier POs | money | POs, inbound | New PO |
| members | Team and Shifts | data | on-duty staff | Manage Staff |
| contact | Customer Ledger | customer | total contacts | Add Contact |
| human | Manual Tasks | none | jobs for you | Mark Complete |
| flow | Shop Checklists | none | active runs, % | Resume Flow |
| site | Online Storefront | customer | visits, enquiries | View Store |
| inbox | Team Feed | none | tasks for you | Open Feed |
| chat | WhatsApp Chat | customer | pending chats | Open WhatsApp |
| whatsapp | WhatsApp API | customer | bills sent | Check Delivery |
| telegram | Shop Alerts | none | low stock pings | Send Alert |

## A6. Flows

```
 PLAN  trigger  tap | schedule | event
       steps    [ step, ... ]        max 12
       card     title + 0-2 metrics + 1 tap

 STEP  crud     C | R | U | D
       tool     one registered action only
       input    known at plan time OR ask at run
       gate     auto | ask | approve
       approver assignee | owner    (ask -> assignee, approve -> owner)
       mod      none | retry | repeat | undo | match
```

```
 TRIGGER
   tap       a person presses the card
   schedule  a clock: "every day at 22:00"
   event     a record changed: "when an order is paid"
```

| Gate | Who acts | When |
| :--- | :--- | :--- |
| auto | code | inputs known AND reach in {none, data} |
| ask | person | input missing OR physical step |
| approve | owner / admin | money, customer, or over limit |

| Modifier | Meaning | Scope | Limits |
| :--- | :--- | :--- | :--- |
| retry | run once more on failure | step | 3 attempts, backoff 2^n seconds |
| repeat | again until state changes, or per row | flow / row | max 100 rows or 5 min timeout |
| undo | opposite posting | step | undo failure -> owner approval |
| match | read two sources, update the match | plan | - |

Every flow is one of these forms. No other shape exists.

| Form | Gate | Approver | Modifier | Reads as |
| :--- | :--- | :--- | :--- | :--- |
| straight | auto | - | none | send a report |
| ask | ask | assignee | none | count the drawer |
| approval | approve | owner | none | approve a refund |
| loop | auto | - | repeat | chase every unpaid quote |
| batch | auto | - | repeat, per row | message every contact |
| reverse | approve | owner | undo | refund an invoice |
| retry | auto or ask | - | retry | retry a failed action |
| reconcile | auto | - | match | reconcile two reads |

```
 JEV picks tool + gate + modifier.
 CODE checks the tool supports them, else falls back to derived gate/mod.
 CODE upgrades gate on safety floor: auto + money -> approve.
```

### Runtime is deterministic

```
 TAP / SCHEDULE / EVENT -> GATE -> CRUD -> EVENT -> INBOX -> EVERY CANVAS SYNCS
```

| Rule | Meaning |
| :--- | :--- |
| No model on render | cards read records / metrics |
| No model on run | steps are deterministic |
| One write | one step commits alone |
| Retry safe | same run + step never doubles |
| Reversible | one-tap undo |

## A7. Access

```
 workspace enabled AND JEV grants for this member AND now = visible cards
```

```
 JEV reads: "cashier, packs orders, no price edits"
   -> ALLOW  Counter Sales, Cash Drawer, Order Fulfilment, Inbox
   -> HIDE   Products and Prices, Store Studio, Team, Revenue
 Roles never picked from a dropdown. Grants derived, not assigned.
```

| Card or action | Owner | Admin | Cashier | Guest |
| :--- | :---: | :---: | :---: | :--- |
| Counter Sales (pos) | Full | Full | Execute only | Denied |
| Cash Drawer (register) | Full | Full | Shift only | Denied |
| Revenue Summary | Full | Full | Hidden | Denied |
| Order Packing (order) | Full | Full | Full | Denied |
| Pricing and Catalog | Full | Full | View only | Denied |
| Storefront Studio | Full | Full | View only | Public view |
| Team and Grants | Full | Full | Hidden | Denied |

Full = see + act. Execute only = act, no settings. View only = see only.
Shift only = act in a shift. Hidden = not shown. Denied = no access.

One person may belong to several workspaces; each isolated.

## A8. Inbox: role-aware, context-filtered

Inbox shows only what this person can act on, right now. No event dump.

```
 EVENT (workspace-wide)
      |
      v
 FILTER by role + shift + reach
      |
      v
 SORT by overdue + reach + due + assigned
      |
      v
 INBOX (personal, actionable only)
```

### Filter rules

| Event | Owner sees | Cashier sees | Why |
| :--- | :---: | :---: | :--- |
| Refund approval needed | yes | - | money reach, owner only |
| Count cash drawer | yes | yes | assigned to cashier, owner can see |
| Low stock alert | yes | - | owner manages inventory |
| Pack order | yes | yes | both can act |
| Store draft ready | yes | - | owner publishes |
| Cash drawer mismatch | yes | - | owner audits |

Same 18 events -> owner sees 6, cashier sees 2.

### Sort order (automatic)

```
1. OVERDUE + high reach (money/customer first)
2. DUE NOW + assigned to you
3. DUE TODAY + you can act
4. LATER + background alerts
```

### Three actions only

```
[ Complete ]  marks done, writes record, event archived
[ Defer ]     snooze: 1 hour / tomorrow / next week
[ Assign ]    send to another member (owner/admin only)
```

No delete. Events stay, marked read/archived. Hidden from inbox, visible in history.

### Screen: Cashier inbox

```
+--------------------------------------------+
| INBOX                              2 of 18 |
+--------------------------------------------+
| OVERDUE                                    |
| ! Count cash drawer              Shift 14  |
|   Due 3:45pm                  [ Complete ] |
+--------------------------------------------+
| NOW                                        |
| Pack order for Senthamizh        2 items   |
|   Courier pickup 4:30pm       [ Complete ] |
+--------------------------------------------+
| 16 other tasks hidden (not your role)      |
+--------------------------------------------+
```

### Screen: Owner inbox

```
+--------------------------------------------+
| INBOX                              6 of 18 |
+--------------------------------------------+
| URGENT - NEEDS APPROVAL                    |
| ! Refund request Rs. 2,000    Customer #89 |
|   Reason: damaged item         [ Approve ] |
+--------------------------------------------+
| OVERDUE                                    |
| Cash drawer mismatch Rs. 350    Shift 14   |
|   Kanimozhi's count             [ Audit ]  |
+--------------------------------------------+
| TODAY                                      |
| Low stock alert: 3 items                   |
|   Silk, Cotton scarf            [ Review ] |
+--------------------------------------------+
| Store draft ready to publish               |
|   2 sections added              [ View ]   |
+--------------------------------------------+
| + 2 tasks for later                        |
| 12 tasks handled by staff (hidden)         |
+--------------------------------------------+
```

### Storage

```
inbox_items table (Turso)
  workspace_id
  member_id       who sees this
  event_id        source event
  reach           money | customer | data | none
  due_at          when it's due
  assigned_to     specific member or null
  status          pending | deferred | completed | archived
  deferred_until  when to show again
```

On event write -> compute inbox items for all eligible members -> insert rows.
Member reads their `member_id` rows, sorted by the rules above.

### Overflow handling

If 200+ events overnight:
- Group by type: "3 low stock alerts" (collapse)
- Defer non-urgent to "Later" section
- Owner/admin sees summary: "47 tasks waiting, 12 need you"

## A9. Where Jev decides

One request carries many questions.

| # | Judgment | Type | Replaces |
| :-: | :--- | :--- | :--- |
| 1 | Cards this workspace needs | CHOICE over 18 | module picker |
| 2 | Cards this member may see | NOUL per card | role dropdown |
| 3 | Job this member does | CHOICE over roles | job dropdown |
| 4 | Action this request means | CHOICE over registry | intent regex |
| 5 | Action each flow line means | CHOICE per line, batched | line regex |
| 6 | Variant of this product | CHOICE over variants | variant picker |
| 7 | Is this step needed | NOUL per step | over-built flows |
| 8 | Is the plan complete | NOUL | half-built flows |
| 9 | Does an action already do this | NOUL | fake steps |
| 10 | Is this card useful now | NOUL per card | fixed card list |
| 11 | Next card for this role | CHOICE over 6 | render-time rank |
| 12 | Urgency for this role | SCORE over 3 | fixed priority |
| 13 | Is this order amount normal | NOUL | fraud net |
| 14 | Which commerce models | NOUL per model | model picker |
| 15 | Which trade | CHOICE over 9 | trade picker |
| 16 | Which capabilities | CHOICE x4 | checkboxes |
| 17 | Which design | CHOICE over 6 | default design |
| 18 | Which recipe per section | CHOICE per type | default recipe |
| 19 | Spotlight, story, trust | NOUL x3 | fixed sections |

Judgment 10 is the "now" in access. Judgment 6 is the variant.

| Type | Ask | Use for | Never |
| :--- | :--- | :--- | :--- |
| CHOICE | pick one of N | tool, variant, design, recipe, next card | N large: split into levels |
| NOUL | how likely yes | risk, gap, needed, useful, normal | compute anything |
| SCORE | where on a ladder | tier, quality, graded rank | exact number |

```
 ONE REQUEST
 +-------------------------------------------+
 | state filtered to what the questions need |
 | q1 CHOICE  which tool?                    |
 | q2 CHOICE  which variant?                 |
 | q3 NOUL    does this move money?          |
 | q4 NOUL    is this card useful now?       |
 | q5 SCORE   how urgent?                    |
 +-------------------------------------------+
             |
             v
   one batched call -> many typed answers
```

13 questions in one call: ~12x cheaper, ~10x faster than 13 calls, same answers.

### Rules

1. Never ask for an id the model did not see. Shortlist in code, let the model select.
2. Never let a model compute a number, a count, a total, or compare dates.
3. One request, many questions. Never one request per question.
4. Send only what the question needs. Extra detail is noise.
5. Cache on model version + question version + the exact state the question reads.
6. Pin the model id, not the alias.
7. Every deep answer must graduate to the fast path, or the bill never drops.
8. Money or customer = confirm. Always. Not model decided.
9. A lane never crosses. The model never commits, never grants, never computes.

```
 NEVER MODELED
   ids from prose    money maths    stock maths
   date compare      posting balance    access grants
   publish decisions  layout tokens    html render
```

## A10. The certainty ladder

Never pay for a decision you could have made without a model. Each rung has one exit test.

```
  WORDS / TAP
      |
      v
  [L0] LITERAL -------------------------------------> plan       0 calls
      |  no match
      v
  [L1] MEMORY  -------------------------------------> plan       0-1 calls
      |  no near match
      v
  [L2] PROSE   (LLM)   step phrases --------------->            1 call
      |
      v
  [L3] DECIDE  (Jev)   tool / variant / risk /     -->            1 call
      |                rank / gap
      v
  [L4] VERIFY  (Jev)   does each step match? ------>            1 call
      |
      v
  [L5] CONFIRM (human) approve the plan
      |
      v
  [COMPILE] --------------> card
      |
      v
  [RUN] -----------------> 0 model calls, forever
```

| Rung | Who | Calls | Question it answers | Exit test |
| :--- | :--- | :---: | :--- | :--- |
| L0 Literal | code | 0 | does the wording match a known intent | exact match, compile |
| L1 Memory | code + Jev | 0-1 | is this the same shape as a saved plan | near match, fill the slots |
| L2 Prose | LLM | 1 | what are the steps, in words | always goes to L3 |
| L3 Decide | Jev | 1 batched | which tool, which variant, how risky, how useful | p + margin, go to L4 |
| L4 Verify | Jev | 1 batched | does each step actually do this | all yes, go to L5 |
| L5 Confirm | human | 0 | is this what you meant | approve, compile |
| Run | code | 0 | - | forever |

A plan is remembered by the shape of the request, not its words.
"every day at 10 send a sales report" and "send me a sales report at 10 every morning" are one plan.

### Plan memory storage

```
plans table (Turso)
  workspace_id     which shop
  shape_hash       hash of (trigger type + action sequence)
  steps            compiled step array
  trigger          tap | schedule | event
  confirmed_at     when owner approved
  accuracy_score   tracked per workspace for adaptive thresholds
```

Memory lookup: hash the normalized request shape -> exact match in plans table -> reuse.
No match -> L2 Prose. Accuracy tracking adjusts confidence thresholds per workspace.

```
 0 model calls on a card render      0 model calls on a publish
 0 model calls on a flow run         0 model calls on a scheduled run
```

| Request | Naive | Ladder |
| :--- | :---: | :---: |
| known intent | 3 calls | 0 |
| similar intent | 3 calls | 1 |
| new intent | 5 calls | 3 |
| every run afterwards | 3 calls | 0 |
| a card's glance value | a model call | a materialized read |

### Reading a Jev answer

```
  p(chosen)   0.86  ---.
  p(top2)     0.11  ---+---> margin = 0.75   confident -> act
  confidence  0.41  ---'
```

| Signal | Meaning | Use |
| :--- | :--- | :--- |
| p(chosen) | chance the pick is right | above threshold act, else ask |
| margin | p(top1) - p(top2) | small margin = ambiguous, ask |
| confidence | how concentrated the spread is | only to detect a spread answer |

Never auto-act on confidence alone. Above threshold is never correctness; use p plus margin.

## A11. Two model batches, then zero

```
 SETUP (once)
  Merchant: "Weave silk sarees, UPI + cash counter, ship nationwide, need store"
       |
  JEV #1  business -> { models, industry, capabilities }
       |
  CODE    shortlist designs and recipes
       |
  JEV #2  look -> { design, recipe per type, spotlight?, story?, trust? }
       |
  CODE    assemble draft + gate

 LIFETIME
  similar intent  -> memory hit, 0 LLM, 1 JEV
  exact repeat    -> 0 LLM, 0 JEV
  every render and run -> 0 LLM, 0 JEV
```

```
 WORDS -> LLM sketch -> JEV batch -> CODE wire -> OWNER confirms -> MEMORY -> RUN (0 calls)
```

| Risk | Auto only if | Else |
| :--- | :--- | :--- |
| none / data | p >= 0.60, margin >= 0.30 | ask |
| customer | p >= 0.80, margin >= 0.40 | confirm |
| money | p >= 0.85, margin >= 0.50 | confirm + owner |

| Moment | LLM | JEV | Code |
| :--- | :---: | :---: | :--- |
| New intent, first time | 1 sketch | 1 batch | compile |
| Similar to memory | 0 | 1 choice | instantiate |
| Exact repeat | 0 | 0 | instantiate |
| Every run / every render | 0 | 0 | execute / read |
| Workspace setup total | 1 | 2 | - |
| Daily operation, 100 runs | 0 | 0 | - |

## A12. Commerce kernel

One shared kernel supports retail, restaurant, supermarket, delivery, taxi,
services and future domains. A domain adds facts and actions; it never forks
inventory, orders, payments or accounting.

```
BUY                                             SELL
supplier -> purchase -> receive -> on hand
                                    |
customer -> order -> reserve -> fulfil -> invoice -> payment -> refund
                                    |
                              balanced postings
```

### A12.1 Rules

Money is integer minor units plus ISO currency. Quantity is integer base units;
display conversion belongs to the product unit. Price is server resolved from an
active price record. Stock is `available = onhand - reserved` and never
negative. Orders and invoices snapshot commercial facts. Every mutation is a
registered action + permission + idempotency key + audit event. Every business
event writes balanced postings. Every record belongs to one workspace.

### A12.2 Records

Commerce uses the shared `records` table. `type` selects the contract; `data`
holds versioned fields. No table is created per trade. All workspaces share one
Turso database; `workspace_id` provides isolation.

| Type | Core fields | States | Limits |
| :--- | :--- | :--- | :--- |
| `item` | name, unit, tax, status | active, archived | - |
| `variant` | item, sku, barcode, attributes | active, archived | max 50 per item |
| `price` | variant, amount, currency, channel, starts, ends | active, archived | - |
| `stock` | variant, location, onhand, reserved | active | - |
| `purchase` | supplier, lines, currency, totals | draft, ordered, partial, received, cancelled | - |
| `order` | customer, lines, totals, channel | draft, accepted, fulfilled, cancelled | - |
| `invoice` | party, order, lines, totals, due | issued, partial, paid, void | - |
| `payment` | invoice, amount, method, provider, reference | recorded, reversed | - |
| `refund` | payment, amount, reason, reference | recorded | - |
| `posting` | account, debit, credit, source | posted | - |
| `plan` | workspace_id, shape_hash, steps, trigger, confirmed_at | active, archived | reused via shape match |

Files, media, and text over 2KB use R2 cloud storage. The record stores the object
key, hash, size, media type and version. Stock, price, quantity, invoice totals
and payment state never live only in R2. All transactional facts remain in Turso.

### A12.3 Commerce actions

| Action | Commit |
| :--- | :--- |
| `catalog.item.save` | create or revise an item |
| `catalog.variant.save` | create or revise a sellable variant |
| `price.set` | add an effective price |
| `stock.adjust` | audited stock correction |
| `purchase.create` | purchase with exact lines |
| `purchase.receive` | atomically receive lines and increase stock |
| `order.create` | snapshot prices and reserve stock |
| `order.fulfill` | consume reserved stock |
| `order.cancel` | release remaining reservation |
| `invoice.issue` | issue receivable from exact order facts |
| `payment.record` | settle all or part of an invoice |
| `refund.record` | refund within the recorded paid balance |

POS reuses these guarantees for counter work. Cart, register, receipt and
return interactions keep server pricing, stock movement and payment references.

### A12.4 Atomic commits

```
PURCHASE RECEIPT
  validate remaining quantities
    -> update received -> increment stock per variant/location
    -> set partial or received -> append event
COMMIT
over-receipt rejects the whole transaction

CUSTOMER ORDER
  read active prices + stock -> lines/tax/total -> reserve every line
    -> create order snapshot -> append event
COMMIT
any unavailable line rejects the order
fulfilment consumes reserved; cancellation releases only unfulfilled

INVOICE -> PAYMENT -> REFUND
  validate_postings() checks balance BEFORE commit
  invoice.issue   receivable debit + revenue/tax credit
  payment.record  cash/provider debit + receivable credit
  refund.record   reversal bounded by paid/refundable
  balance mismatch -> entire transaction rejected, nothing written
provider and bank references are evidence, not authority
adapters normalize and deduplicate references, then call the Gateway
```

### A12.5 Domains

| Domain | Kernel reuse | Domain addition |
| :--- | :--- | :--- |
| Restaurant | variants, stock, order, payment | stations, course timing, table/delivery handoff |
| Supermarket | catalog, barcode, price, POS | scales, batches, expiry and promotions |
| Delivery | order and payment linkage | pickup, route, proof and settlement |
| Taxi | customer, service order, payment | trip, fare meter, route and driver state |
| Sales team | customer, order, invoice | lead, quote, approval and commission |
| Services | item, order, invoice, payment | booking, time, milestone and acceptance |

### A12.6 Projections and storage

| Actor | Projection |
| :--- | :--- |
| Owner | accept, reject, exception and refund review |
| Kitchen/station | assigned lines and preparation state |
| Courier | reach, collect, deliver and proof |
| Customer | pay, receive and rate |

The parent record remains canonical. Projections expose only fields allowed by
membership, work role and action policy.

| Need | Store |
| :--- | :--- |
| live catalog title, price, availability | Turso records through a public binding |
| product image or long description | R2 object referenced by variant or item |
| invoice facts and status | Turso invoice, payment and posting records |
| rendered invoice PDF | immutable R2 artifact plus hash and version |
| compiled public pages | site release bucket |

Site generation never duplicates inventory as website truth. `site.refresh`
rebuilds catalog bindings from active variants and prices. A public transaction,
when site policy enables it, calls the same order and payment actions.

### A12.7 Recovery and acceptance

| Failure | Recovery |
| :--- | :--- |
| client retries | same key + same hash returns the committed result |
| same key, changed input | conflict |
| provider repeats webhook | unique provider/reference and operation key |
| worker stops after commit | event/result is replayed; effect is not repeated |
| partial multi-record write | transaction rolls back |
| balance mismatch | validate_postings() rejects BEFORE commit, nothing written |

Operational reports derive from orders, stock, payments and postings. They are
projections or artifacts, not editable business truth.

Shipped: catalog, variant, price, stock, purchase, order, invoice, payment and
refund actions are registered in `tarharness/src/commerce/`; receiving,
reservation, fulfilment, cancellation and postings commit atomically; replay
and conflicting keys are tested; POS keeps server pricing, returns, register and
stock controls; Inbox consumes commerce records through authorized projections.

## A13. Status

Markers: `[S]` shipped, `[P]` partly shipped, `[T]` target. This table is the reality check;
the rest of the document describes the target.

| Area | Shipped | Still target |
| :--- | :--- | :--- |
| Commerce kernel: actions, records, postings, stock, archive | `[S]` 116 actions, one records table, 315 tests | - |
| 18 tool cards, roles, per-member grants | `[S]` | - |
| Flows: run, step, resume, idempotency, versioning | `[S]` | - |
| Flow grammar | `[P]` auto/manual | ask/approve, approver, modifiers, triggers, max 12 steps |
| One registry | `[P]` actions and cards separate | stage, reach, card flag on one list |
| Card metrics and the Canvas screen | `[P]` server builds cards; app has Now/Tools/Ask/Records/Routines | Canvas tabs, add-card, live metrics |
| Jev | `[S]` 8 call sites, 7-day cache on the store | cache everywhere, plan memory |
| The store | `[S]` 3 designs, 23 recipes | 100 designs, larger library |

---

# PART B - CONCEPT SCREENS

> Every screen is what a person taps, not how it is built.
> One pattern: title + up to 2 live metrics + one primary tap.

## B0. Setup

Three screens turn a description into a working Canvas. Jev proposes; the owner confirms.

### B0.1 Create a workspace

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | New Workspace                       Cancel |
 +--------------------------------------------+
 | Name your workspace                        |
 | +----------------------------------------+ |
 | | Aambal Neyvagam                        | |
 | +----------------------------------------+ |
 | What do you make and sell?                 |
 | +----------------------------------------+ |
 | | Weave silk and cotton textiles, UPI    | |
 | | and cash counter, ship nationwide,     | |
 | | need an online store.                  | |
 | +----------------------------------------+ |
 | Jev will place the right cards             |
 | on your Canvas.                            |
 | [ Generate Workspace and Canvas ]          |
 +--------------------------------------------+
```

### B0.2 Review the cards Jev selected

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | < Back                               Ready |
 +--------------------------------------------+
 | Your Shop Canvas                           |
 | AAMBAL NEYVAGAM - Salem                    |
 | Handloom and Apparel (95% match)           |
 +--------------------------------------------+
 | JEV SELECTED 5 CARDS                       |
 | [x] Counter Sales                          |
 | [x] Orders and Dispatch                    |
 | [x] Products and Prices                    |
 | [x] Online Storefront                      |
 | [x] Shop Checklists                        |
 | Tap a card to start. More later            |
 | via + Add Card.                            |
 | [ Confirm and Open Canvas ]                |
 +--------------------------------------------+
```

### B0.3 Add a member and their cards

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | < Back                                Done |
 +--------------------------------------------+
 | Add Team Member                            |
 | Workspace: Aambal Neyvagam                 |
 +--------------------------------------------+
 | PHONE OR EMAIL                             |
 | | kanimozhi@aambal.in                    | |
 | WHAT WILL THIS PERSON DO?                  |
 | | Counter cashier. Handles sales,        | |
 | | counts the drawer, packs orders.       | |
 | | Does not edit prices.                  | |
 | CARDS KANIMOZHI CAN SEE                    |
 | [x] Counter Sales                          |
 | [x] Cash Drawer                            |
 | [x] Orders and Dispatch                    |
 | [ ] Products and Prices                    |
 | [ ] Online Storefront                      |
 | Jev assigned: Member (Cashier)             |
 | [ Save and Send Invitation ]               |
 +--------------------------------------------+
```

## B1. Canvas - owner

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | Aambal Neyvagam                   Owner    |
 +--------------------------------------------+
 | ! Cash drawer out by Rs. 350               |
 |   Shift 14 - tap to audit            >     |
 +--------------------------------------------+
 | NEXT  Dispatch order 42        due 15m     |
 |                               [ Complete ] |
 +--------------------------------------------+
 | COUNTER SALES                     SHIFT 14 |
 | Today Rs. 18,450   UPI Rs. 14,100          |
 | 14 bills, drawer cash Rs. 4,350            |
 | [ New Counter Sale ]                       |
 +--------------------------------------------+
 | ORDERS AND FULFILMENT                      |
 | Pending 3      Dispatched today 11         |
 | Next: garment for Senthamizh - Courier     |
 | [ Open Queue ]                             |
 +--------------------------------------------+
 | ONLINE STORE                         LIVE  |
 | aambal.tar.site                            |
 | Visits today 142   WhatsApp enquiries 8    |
 | [ View Store ]                             |
 +--------------------------------------------+
 | SHOP CLOSING ROUTINE              STEP 2/4 |
 | [x] Save invoices                          |
 | [>] Count cash - Kanimozhi                 |
 | [ ] Send summary on Telegram               |
 | [ ] Lock register and close shift          |
 | [=========>          ] 50%  [ Resume ]     |
 +--------------------------------------------+
 | [ + Add a Card ]                           |
 | Message TAR...                         (+) |
 |  (+)    [Canvas]    Flows    Site    You   |
 +--------------------------------------------+
```

Owner sees 6 cards: alert on top, next action, then the stack.

## B2. Canvas - staff

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | Aambal Neyvagam                 Kanimozhi  |
 | Cashier - Shift 14                         |
 +--------------------------------------------+
 | NEXT                                       |
 | Pack parcel for Senthamizh - 2 items       |
 +--------------------------------------------+
 | COUNTER REGISTER                  SHIFT 14 |
 | Bills cleared 9   Drawer cash Rs. 4,350    |
 | [ Quick Sale ]                             |
 +--------------------------------------------+
 | ORDER PACKING QUEUE                        |
 | To pack 2     Packed today 7               |
 | [ Start Packing Next ]                     |
 +--------------------------------------------+
 | INBOX - TASKS FOR YOU                      |
 | 2 waiting, 1 overdue                       |
 | [ Open Feed ]                              |
 +--------------------------------------------+
 | SHIFT HANDOVER FLOW                        |
 | 16:00 - not started                        |
 | [ Start Handover ]                         |
 +--------------------------------------------+
 | Ask TAR a question...                  (+) |
 |  (+)    [Canvas]    Flows    Site    You   |
 +--------------------------------------------+
```

Staff sees 4 cards. Same Canvas, filtered by grants. Inbox tells them what to do.

## B3. Inside a card

```
 +--------------------------------------------+
 | Canvas                         Card detail |
 +--------------------------------------------+
 | +----------------------------------------+ |
 | | [icon] Counter Sales           [SHIFT] | |
 | | Today Rs. 18,450  UPI Rs. 14,100       | |
 | | 14 bills, drawer cash Rs. 4,350        | |
 | | [ New Counter Sale ]                   | |
 | +----------------------------------------+ |
 | Tap title     -> opens detail              |
 | Tap button    -> commits once              |
 | Other actions -> live in detail            |
 +--------------------------------------------+
```

| Card kind | Detail shows | Actions inside |
| :--- | :--- | :--- |
| Tool | list, search, detail | scan, adjust, history |
| Flow | checklist run | per-step action, progress |
| Site | store preview, edit | edit products, view store |
| Channel | feed, chat list | reply, check delivery, send alert |
| Human | today's manual tasks | add photo, mark complete |

## B4. A flow run

```
 +--------------------------------------------+
 | < Back                     Evening Closing |
 +--------------------------------------------+
 | STEP 2 OF 4               Owner: Kanimozhi |
 | [==========>        ] 50%                  |
 +--------------------------------------------+
 | [x] 1  Save invoices                       |
 | [>] 2  Count cash drawer                   |
 | [ ] 3  Send closing summary                |
 | [ ] 4  Lock register                       |
 +--------------------------------------------+
 | [ Perform Step 2 ]                         |
 +--------------------------------------------+
```

`[x]` done, `[>]` now, `[ ]` waiting. One primary tap advances the run.

## B5. Checkout

```
 +--------------------------------------------+
 |         (canvas dimmed behind)             |
 |   . . . . . . . . . . . . . . . . . . . .  |
 +--------------------------------------------+
 | Point of Sale Checkout               Close |
 | AAMBAL NEYVAGAM - Shift 14                 |
 +--------------------------------------------+
 | CART (2)                                   |
 | Silk Fabric                      Rs. 4,500 |
 | Cotton Scarf                       Rs. 850 |
 | Total                            Rs. 5,350 |
 +--------------------------------------------+
 | PAYMENT                                    |
 | (o) UPI QR    ( ) Cash    ( ) Card         |
 | WhatsApp bill to                           |
 | +91 98401 23456                            |
 +--------------------------------------------+
 | Writes order, invoice, payment and         |
 | stock in one commit.                       |
 | Moves money: one confirm.                  |
 | [ Complete Sale - Rs. 5,350 ]              |
 +--------------------------------------------+
```

## B6. Canvas details

### B6.1 Add a card

```
 +--------------------------------------------+
 | < Back                            Add Card |
 +--------------------------------------------+
 | TOOL CARDS - role: Owner                   |
 | [x] Counter Sales                          |
 | [x] Cash Drawer                            |
 | [x] Orders and Dispatch                    |
 | [x] Online Storefront                      |
 | [ ] Stock and Warehouse       [ + ]        |
 | [ ] Supplier POs              [ + ]        |
 | [ ] Daily Expenses            [ + ]        |
 +--------------------------------------------+
 | FLOW CARDS                                 |
 | [x] Evening Closing                        |
 | [ ] Morning Opening           [ + ]        |
 | [ ] Stock Audit               [ + ]        |
 +--------------------------------------------+
 | [ Save Canvas Layout ]                     |
 +--------------------------------------------+
```

`[x]` on Canvas, `[ ]` available. JEV suggested the checked ones.

### B6.2 Product detail

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | < Back                         Add Product |
 +--------------------------------------------+
 | PRODUCT                                    |
 | | Silk Fabric                            | |
 | DESCRIBE IT                                |
 | | Pure silk fabric, red and blue,        | |
 | | sizes S and M.                         | |
 | JEV FOUND 2 DIMENSIONS                     |
 | color   red, blue                          |
 | size    S, M                               |
 | 2 x 2 = 4 VARIANTS                         |
 | [ ] red / S        SKU 001  Rs. 4,500      |
 | [ ] red / M        SKU 002  Rs. 4,500      |
 | [ ] blue / S       SKU 003  Rs. 4,500      |
 | [ ] blue / M       SKU 004  Rs. 4,500      |
 | [ Save Product and 4 Variants ]            |
 +--------------------------------------------+
```

### B6.3 Site detail

```
 +--------------------------------------------+
 | 9:41                                94%    |
 +--------------------------------------------+
 | < Back                        Online Store |
 +--------------------------------------------+
 | aambal.tar.site                       LIVE |
 | Catalog 42 published                       |
 | Visits this week 892                       |
 +--------------------------------------------+
 | TODAY                                      |
 | Visits 142   Orders 6   Enquiries 8        |
 +--------------------------------------------+
 | [ View Store ]    [ Edit Products ]        |
 +--------------------------------------------+
```

### B6.4 Catalog variants

One Jev choice names the dimension; code computes rows, barcodes, stock and prices.
Jev never produces a number.

| Key | Means | Examples |
| :--- | :--- | :--- |
| size | clothing or shoe size | S/M/L, 38/40, King |
| length | textile length or cable | 3m, 5m, 6.2m |
| weight | mass | 250g, 25kg bag, 10g |
| volume | liquid capacity | 500ml, 1L, 5L can |
| color | shade or pattern | red, patterned border |
| flavour | taste or scent | chocolate, sandal |
| material | grade | pure silk, silver 92.5 |
| portion | serving | quarter, half, flask |
| prep | custom option | eggless, lining (+Rs. 150) |
| time | duration | 1 hour, 1 month plan |
| tier | turnaround level | standard 3d, express 1d |
| pack | bundle count | single, pack of 6, box of 50 |

## B7. Store site - web screen flow

Two web surfaces over one kernel: the merchant builds and publishes; the customer browses and orders.

```
+------------------------------------------------------------------------+
|  MERCHANT WEB               |  ONE KERNEL              |  CUSTOMER WEB |
|  describe once              |  site + release          |  storefront   |
|  draft -> gate              |  order + stock           |  item         |
|  [ Publish ]                |  person + event          |  cart         |
|  live status                |  inbox                   |  order        |
+------------------------------------------------------------------------+
|  Every screen below is a read or one commit. No model at render or run.|
+------------------------------------------------------------------------+
```

| # | Screen | Who | Commits |
| :-: | :--- | :--- | :--- |
| 1 | Store Studio | owner | reads site + gate |
| 2 | Describe once | owner | brief + facts |
| 3 | Building | code | draft record |
| 4 | Draft editor | owner | one site version |
| 5 | Gate | code | draft stays |
| 6 | Publish confirm | owner | live release |
| 7 | Storefront | customer | - |
| 8 | Item | customer | - |
| 9 | Cart and checkout | customer | order + stock + person |
| 10 | Order placed | code | event -> Inbox |

Only screen 3 pays for a model. From screen 4 on, every tap is a read, a render, or one commit.

### B7.1 Store Studio - draft

```
+------------------------------------------------------------------------+
|  Online Store                                  DRAFT      [ Publish ]  |
+------------------------------------------------------------------------+
|  aambal.tar.site                     42 items, 10 sections             |
|  Draft saved 10:02                   Never published                   |
+------------------------------------------------------------------------+
|  HOW THE STORE LOOKS                                                   |
|  Luxury   paper #F7F3EA   ink #1F1A17   accent #A63A2B     [ Change ]  |
+------------------------------------------------------------------------+
|  WHAT CUSTOMERS SEE                                         2 missing  |
|  [x] Header      brand          [x] Trust      proofs                  |
|  [x] Spotlight   overlay        [x] FAQ        disclosure              |
|  [x] Hero        commerce       [x] Policy     disclosure              |
|  [x] Catalog     grid 42        [ ] Contact    add phone               |
|  [x] Footer      card           [ ] Booking    add 1 service           |
+------------------------------------------------------------------------+
|  ONLINE ORDERS                                                     ON  |
|  Customers can place orders. The shop confirms every payment.          |
|  [ View draft ]     [ Edit products ]                                  |
+------------------------------------------------------------------------+
```

### B7.2 Describe once

```
+------------------------------------------------------------------------+
|  < Back                                           Describe your store  |
+------------------------------------------------------------------------+
|  Describe the business once. Every part can be changed later.          |
|                                                                        |
|  YOUR WORDS                                                            |
|  "We weave handloom silk sarees in Kanchipuram. UPI and cash at        |
|   the counter. We ship nationwide and take festival orders."           |
|                                                                        |
|  [ Edit words ]                                                        |
+------------------------------------------------------------------------+
|  FACTS ON RECORD                                                       |
|  [x] 42 items with photos          [x] Hours  Mon-Sat 10-20            |
|  [x] Silk Mark proof               [x] Season Pongal sale              |
|  [x] Apparel, Kanchipuram          [ ] Contact  add phone              |
|  [ ] Bookable service                                                  |
|                                                                        |
|  Missing facts stay in the gate. They never block the draft.           |
|                                                                        |
|  [ Build draft ]                                                       |
+------------------------------------------------------------------------+
```

### B7.3 Building the draft

```
+------------------------------------------------------------------------+
|  BUILDING YOUR STORE                                                   |
+------------------------------------------------------------------------+
|  [x]  Read the business       products, booking, apparel               |
|  [x]  Choose a look           luxury, grid catalog, commerce hero      |
|  [x]  Write the pages         10 sections in code order                |
|  [>]  Check what is missing   booking service, contact phone           |
|                                                                        |
|  [=======================>        ]  75%                               |
|                                                                        |
|  The draft is saved at every step. Nothing is public yet.              |
+------------------------------------------------------------------------+
```

### B7.4 Draft editor

```
+------------------------------------------------------------------------+
|  < Back   Online Store                         DRAFT      [ Publish ]  |
+------------------------------------------------------------------------+
|  aambal.tar.site   Desktop [x]  Tablet [ ]  Phone [ ]  2 missing       |
+------------------------------------------------------------------------+
|  SECTIONS                   |  AAMBAL NEYVAGAM     catalog  contact    |
|  [x] Header      brand      |  +------------------------------------+  |
|  [x] Spotlight   overlay    |  | PONGAL SALE 20% OFF                |  |
|  [x] Hero        commerce   |  | Handloom silk sarees - Kanchipuram |  |
|  [x] Catalog     grid 42    |  | [ Shop Now ]                       |  |
|  [x] Trust       proofs     |  +------------------------------------+  |
|  [x] FAQ         disclosure |  | SILK      COTTON      FABRIC       |  |
|  [x] Policy      disclosure |  | Rs. 4,500 Rs. 850      Rs. 1,200   |  |
|  [ ] Contact     add phone  |  | [ 42 items, 3 columns, photos ]    |  |
|  [ ] Booking     add 1      |  +------------------------------------+  |
|  [x] Footer      card       |  | SILK MARK  Certified handloom      |  |
|                             |  +------------------------------------+  |
|  GATE  2 missing            |  | Pongal offer | Book | FAQ          |  |
|  [ ] booking service        |  +------------------------------------+  |
|  [ ] contact phone          |                                          |
|                             |  Tap a section to change its             |
|  [ Add what is missing ]    |  layout, words or media.                 |
|                             |  Each change is one version.             |
|                             |  Publish stays top right.                |
|                             |                                          |
+------------------------------------------------------------------------+
```

### B7.5 Gate: not ready

```
+------------------------------------------------------------------------+
|  NOT READY TO PUBLISH                                           DRAFT  |
+------------------------------------------------------------------------+
|  Your draft is saved. Two things are still missing:                    |
|                                                                        |
|  [!] Booking   Add 1 bookable service with price    [ Open services ]  |
|  [!] Contact   Add a phone or email                   [ Add contact ]  |
|                                                                        |
|  Ready: 42 priced items, hours, Silk Mark proof, Pongal spotlight.     |
|                                                                        |
|  [ Back to draft ]                                                     |
+------------------------------------------------------------------------+
```

Each fix writes one record. On record.created event, gate check runs and draft auto-rebuilds if now complete.

### B7.6 Publish confirm

```
+------------------------------------------------------------------------+
|  Publish this store?                                  aambal.tar.site  |
+------------------------------------------------------------------------+
|  42 items     1 bookable service     Catalog + booking                 |
|  Contact      +91 98401 23456        Hours Mon-Sat 10-20               |
|                                                                        |
|  The draft goes live at this address. Customers can browse and order.  |
|  One tap publishes. One tap unpublishes.                               |
|                                                                        |
|  [ Cancel ]                                         [ Publish store ]  |
+------------------------------------------------------------------------+
```

### B7.7 Live storefront

```
+------------------------------------------------------------------------+
|  AAMBAL NEYVAGAM                   [ catalog ]  [ book ]  [ contact ]  |
+------------------------------------------------------------------------+
|  PONGAL SALE  20% OFF                                                  |
|  Handloom silk sarees - Kanchipuram                                    |
|  [ Shop Now ]                                                          |
+------------------------------------------------------------------------+
|  Handloom silk, woven in Kanchipuram.                                  |
|  Six generations of weavers. Silk Mark certified.                      |
+------------------------------------------------------------------------+
|  SILK                     COTTON                   FABRIC              |
|  Rs. 4,500                Rs. 850                  Rs. 1,200           |
|  [ photo ]                [ photo ]                [ photo ]           |
|  42 items, 3 columns, all prices in INR                                |
+------------------------------------------------------------------------+
|  SILK MARK  Certified handloom      BOOK A VISIT   [ See times ]       |
+------------------------------------------------------------------------+
|  FAQ  |  POLICY  |  HOURS  Mon-Sat 10-20     |  CONTACT  WhatsApp      |
|  Aambal Neyvagam - Kanchipuram - +91 98401 23456           [ top ]     |
+------------------------------------------------------------------------+
```

### B7.8 Item page

```
+------------------------------------------------------------------------+
|  AAMBAL NEYVAGAM                             [ cart 2 ]   [ contact ]  |
+------------------------------------------------------------------------+
|  +------------------------------+    Kanchipuram Silk Saree            |
|  |                              |    Rs. 4,500                         |
|  |        [ saree photo ]       |    Pure silk, handwoven, Silk Mark   |
|  |                              |    Colour  [ maroon  v ]             |
|  +------------------------------+    Border  [ gold    v ]             |
|                                      Qty     [ 1 ]                     |
|                                                                        |
|                                      [ Add to cart ]                   |
|                                      [ Ask on WhatsApp ]               |
|                                                                        |
+------------------------------------------------------------------------+
|  WHAT BUYERS ASK                                                       |
|  Is this pure silk?       Yes. Every saree carries the Silk Mark.      |
|  When does it ship?       Next working day.                            |
|  Can I order by phone?    Yes. Message the shop on WhatsApp.           |
+------------------------------------------------------------------------+
```

### B7.9 Cart and checkout

```
+------------------------------------------------------------------------+
|  AAMBAL NEYVAGAM                                           [ cart 2 ]  |
+------------------------------------------------------------------------+
|  YOUR CART                                                             |
|  Kanchipuram Silk Saree   maroon / gold   1                 Rs. 4,500  |
|  Cotton Scarf             natural         1                 Rs.   850  |
|  Total                                                      Rs. 5,350  |
+------------------------------------------------------------------------+
|  WHO IS THIS FOR                                                       |
|  Name   [ ____________________________________________ ]               |
|  Phone  [ ____________________________________________ ]               |
|  Note   [ ____________________________________________ ]               |
+------------------------------------------------------------------------+
|  [ Place order - Rs. 5,350 ]                  Payment on confirmation  |
|  One order. Stock reserved. The shop sees it at once.                  |
+------------------------------------------------------------------------+
```

### B7.10 Order placed

```
+------------------------------------------------------------------------+
|  ORDER PLACED                                               Order #42  |
+------------------------------------------------------------------------+
|  Rs. 5,350             Awaiting confirmation on WhatsApp               |
|  Contact               +91 98401 23456                                 |
|                                                                        |
|  The order is already in the Orders card and the Inbox.                |
|  Stock is reserved. The counter and the web store share one count.     |
|                                                                        |
|  [ Keep shopping ]                                                     |
+------------------------------------------------------------------------+
```

Desktop is shown. The same document renders phone and tablet from the same sections, with no second build. Screen 9 is the public web checkout; B5 is the counter checkout.

## B8. Business manager

```
 +--------------------------------------------+
 | < Back                    Business Manager |
 +--------------------------------------------+
 | Aambal Neyvagam                            |
 | 14 stages, 9 live, Jev suggests 5          |
 +--------------------------------------------+
 | LIVE                                       |
 | [x] SELL     Counter, register, store   >  |
 | [x] STOCK    Warehouse stock, batches   >  |
 | [x] SOURCE   POs, GRN, supplier ledger  >  |
 | [x] CATALOG  Items, prices per channel  >  |
 | [x] ORDER    Orders, invoices, dispatch >  |
 | [x] MONEY    Ledger, P&L, GST       Health |
 | [x] PEOPLE   Shifts and attendance      >  |
 | [x] COMMS    Inbox, WhatsApp, alerts    >  |
 +--------------------------------------------+
 | JEV SUGGESTS                               |
 | [ ] MAKE     BOM and weaving runs   Enable |
 | [ ] PLAN     Demand forecast, MRP   Enable |
 | [ ] SERVE    Leads and bookings     Enable |
 | [ ] MOVE     Courier routes, POD    Enable |
 | [ ] COMPLY   Licenses and expiry    Enable |
 +--------------------------------------------+
 | Backups daily 3:00 AM - last OK today      |
 | [ Download Backup ] [ Export GST ]         |
 +--------------------------------------------+
```

Every capability is a CRUD action. A stage is a tag for the Business Manager.

| Stage | Count | Lives in |
| :--- | :---: | :--- |
| Plan | 4 | projections, flows: forecast, S&OP, budgets, MRP |
| Source | 10 | purchase, contact: suppliers, RFQ, PO, GRN, AP, returns |
| Stock | 10 | inventory: ledger, locations, counts, transfers, batches |
| Make | 7 | recipe + flow: BOM, work orders, scheduling, scrap, QC, costing |
| Catalog | 4 | item: items, variants, units, channel price lists |
| Sell | 10 | pos, register, site: POS, register, print, offline, web store |
| Order | 7 | order, invoice: quotes, orders, reservations, GST, credit |
| Money | 16 | postings: ledger, AP/AR, bank rec, expenses, GST, assets, P&L |
| People | 7 | members, flow: staff, roles, shifts, attendance, payroll |
| Serve | 9 | contact: leads, pipeline, tickets, bookings, time billing |
| Move | 5 | order: carriers, routes, POD, fleet, trips |
| Comply | 4 | records: QC, licenses, statutory dates, vault |
| Comms | 5 | inbox, whatsapp, telegram: tasks, flows, alerts |
| Manage | 12 | dashboards, approvals, branches, backups, settings |

### B8.1 Stage detail

```
 +--------------------------------------------+
 | < Back                                SELL |
 +--------------------------------------------+
 | 10 CAPABILITIES                       live |
 | Counter Sales             bills, drawer  > |
 | Cash Drawer               float, count   > |
 | Online Store              visits, orders > |
 | Offers and Discounts      active         > |
 | Offline Queue             2 sales waiting> |
 | + 5 more                                   |
 +--------------------------------------------+
 | [ Add Card to Canvas ]                     |
 +--------------------------------------------+
```

### B8.2 Financial Health

```
 +--------------------------------------------+
 | < Back                    Financial Health |
 +--------------------------------------------+
 | October 2026                        Aambal |
 +--------------------------------------------+
 | Revenue                       Rs. 342,800  |
 | COGS                          Rs. 188,400  |
 | Gross profit                  Rs. 154,400  |
 | Expenses                       Rs. 38,200  |
 | Net profit                    Rs. 116,200  |
 +--------------------------------------------+
 | GST collected                   Rs. 17,140 |
 | GST input                        Rs. 9,420 |
 | GST due                          Rs. 7,720 |
 +--------------------------------------------+
 | [ View Ledger ]   [ Export GST ]           |
 +--------------------------------------------+
```

## B9. Inbox

`event -> who -> one tap -> what changes`

| Event | Goes to | One tap | What changes |
| :--- | :--- | :--- | :--- |
| Cash variance at close | Owner | Audit Shift | shift flagged |
| Refund over limit | Owner | Approve Refund | invoice refunded |
| Low stock | Owner | Create PO | purchase created |
| Paid order placed | Packer | Mark Packed | order packed |
| Invoice past due | Owner | Send Reminder | reminder sent |
| Unverified UPI | Cashier | Verify Reference | payment cleared |
| Payout over limit | Owner | Approve Payout | expense approved |
| Shipment delivered | Stock member | Receive Stock | stock increased |
| Physical task due | Assignee | Tap Done | step completed |
| Flow step ready | Assignee | Open Step | run advances |

```
 +--------------------------------------------+
 | Inbox                               3 NEW  |
 +--------------------------------------------+
 | [!] Cash variance  Rs. 350  Shift 14  >    |
 |     [ Audit Shift ]                        |
 +--------------------------------------------+
 | [ ] Pack order #42  2 items  due 15m  >    |
 |     [ Mark Packed ]                        |
 +--------------------------------------------+
 | [ ] Verify UPI  Rs. 5,350  ref ...812  >   |
 |     [ Verify Reference ]                   |
 +--------------------------------------------+
```

Inbox is mandatory for every member. One event = one card for the right person.

---

# PART C - THE STORE

B7 owns the web screens. This part owns the models, look and gate they show.

```
 BUILD TIME
 designmds/*.md
   parse, validate, tag, review
   -> designs/index.json + designs/tokens/<id>.json
   -> shortlist by model + industry, max 6
```

```
 MERCHANT DESCRIBES ONCE
        |
        v
 JEV #1  business -> models, industry, capabilities
        |
        v
 CODE    shortlist designs + recipes, max 6
        |
        v
 JEV #2  look -> design, recipe per type, optional sections
        |
        v
 CODE    assemble draft in fixed section order
        |
        v
 GATE    fail -> draft + missing list
        |       pass -> [ Publish ] one tap
        v
 LIVE STORE  same kernel, same cards
```

## C1. Models

Axis A, model, drives sections and the publish gate. Axis B, industry, drives copy and the design shortlist.

| Model | Money moves when | Required sections | Gate must have |
| :--- | :--- | :--- | :--- |
| products | buys an item | header, hero, catalog, policy, contact, footer | 1 item, contact |
| food | orders a meal | header, hero, menu, location, contact, footer | 1 menu item, contact, hours |
| booking | books a time | header, hero, booking, faq, contact, footer | 1 bookable service, contact |
| quote | asks a price | header, hero, booking, faq, contact, footer | contact, enquiry route |
| digital | downloads or subscribes | header, hero, catalog, policy, faq, contact, footer | 1 priced item, contact |
| bulk | buys in volume | header, hero, catalog, faq, contact, footer | 1 item, enquiry route, min order |

A store can carry several models. Required sections are the union. Optional sections come from facts or a Jev yes/no. Code rejects an empty model set and asks when confidence is below 0.60.

## C2. Design

| Check | Rule |
| :--- | :--- |
| required tokens | paper, ink, surface, accent, radius, type scale present |
| units | every size in px or rem |
| contrast | body on paper, paper on accent, at least 4.5:1 |
| id | one lowercase semantic word, unique |
| tags | tone matches the palette |
| source | file hash and license note present |

```
 { "id": "luxury", "tone": "light", "industries": ["apparel", "jewellery", "craft"],
   "models": ["products", "quote"], "density": "airy", "imagery": "editorial",
   "contrast": 4.9, "swatches": ["#ffffff", "#000000", "#3b281d", "#f7f4f1"] }
```

Each design is `designs/index.json` plus `designs/tokens/<id>.json`.

```
 100 curated designs -> index row each: id, tone, industries, models, density, swatches
        |
        v
 shortlist by model + industry, max 6
        |
        v
 JEV #2 picks from the shortlist only
```

| Design | Tone | Industry | Density | Imagery |
| :--- | :--- | :--- | :--- | :--- |
| luxury | light | apparel, jewellery, craft | airy | editorial |
| warm | dark | food, craft | balanced | warm |
| commerce | light | products, digital, bulk | compact | product |
| editorial | light | quote, booking | airy | large |
| bold | dark | products, food | compact | full-bleed |
| calm | light | booking, quote | balanced | minimal |

## C3. Recipes

A recipe is data: layout and slots, never copy or assets.

```
 {
   "id": "split",
   "type": "hero",
   "models": ["products", "food", "booking", "quote", "digital", "bulk"],
   "needs": { "media": "optional" },
   "layout": { "kind": "split", "ratio": "50/50", "collapse": "stack" },
   "slots": {
     "headline": { "source": "brief.headline", "max": 80 },
     "body":     { "source": "brief.summary", "max": 240 },
     "media":    { "source": "photos[0]", "optional": true },
     "cta":      { "source": "route.primary" }
   },
   "settings": { "reverse": "boolean", "ctaLabel": "text" }
 }
```

| Primitive | Meaning |
| :--- | :--- |
| stack | vertical blocks, token spacing |
| row | horizontal blocks, wraps at breakpoint |
| grid | n columns, responsive count |
| split | two regions, ratio from token |
| overlay | media + content + scrim |
| rail | horizontal scroll with snap |
| disclosure | expandable list |

| Type | Used by |
| :--- | :--- |
| header | all |
| announcement | when a notice exists |
| hero | all |
| spotlight | Jev yes/no |
| catalog | products, digital, bulk |
| menu | food |
| booking | booking, quote |
| story | Jev yes/no |
| trust | Jev yes/no, needs proof |
| faq | booking, quote, digital, bulk |
| policy | products, digital |
| location | food, booking |
| contact | all |
| footer | all |

```
 SECTION ORDER (code owns it)
   header, announcement?, lead, hero, ..., trust?, faq?, policy?, location?, contact, footer
```

Each section reads slots: headline, body, media, cta. Settings the merchant edits: reverse, cta label, and per-section values.

## C4. Jev in the store

JEV #1, the business:

```
 { "models": ["products", "booking"], "industry": "apparel",
   "capabilities": { "pos": false, "commerce": true, "site": true, "team": true },
   "confidence": { "models": 0.85, "industry": 0.95 } }
```

JEV #2, the look:

| Decision | Type | Options | Threshold |
| :--- | :--- | :--- | :--- |
| design | CHOICE | shortlist, max 6 | 0.55 |
| recipe per type | CHOICE | that type's shortlist | 0.55 |
| lead | CHOICE | spotlight, catalog, story | 0.55 |
| spotlight, story | NOUL | yes, no | 0.65 |
| trust | NOUL | only if proof exists | 0.65 |

Below threshold, code uses the default. Jev never invents an option.

## C5. Overrides and the gate

| Override | Stored as | Beats Jev |
| :--- | :--- | :--- |
| design | design id | yes |
| recipe per section | recipe id | yes |
| settings | values from the schema | yes |
| text | slot value | yes |
| section on / off | flag | yes, except required |

Overrides survive regeneration. Jev sees them as fixed picks, so it does not fight them.

```
 CODE owns      section order, layout grammar, publish gate, checkout,
                payment, tax, shipping, SEO, prices, totals, stock
 MERCHANT owns  design, recipes, settings, text, publish
 JEV owns       which options, with a probability
```

---

# PART D - THREE TRACES

## D1. Daily sales report - straight

```
 every day at 10 am send me a sales report
```

| # | Step | Lane | Commits |
| :-: | :--- | :--- | :--- |
| 1 | understand goal, trigger, slots | LLM | - |
| 2 | pick action, gate, trigger | JEV | - |
| 3 | step needed, plan complete | JEV | - |
| 4 | wire inputs, derive gate | CODE | - |
| 5 | owner confirms | HUMAN | - |
| 6 | save the plan | CODE | memory |
| 7 | read sales | CODE | - |
| 8 | create the delivery | CODE | 1 row |

```
 day 1   2 model calls
 day 2+  0 model calls, the plan is remembered

 10:00 -> read sales -> create delivery -> card shows the last run

 +--------------------------------------+
 | DAILY SALES REPORT                   |
 | Last  today 10:00                    |
 | Next  tomorrow 10:00                 |
 | [ Run now ]                          |
 +--------------------------------------+
```

## D2. Refund approval - approval

```
 refunds above Rs. 2,000 need my approval
```

| # | Step | Lane | Gate | Commits |
| :-: | :--- | :--- | :--- | :--- |
| 1 | read invoice and payment | CODE | auto | - |
| 2 | create refund | CODE | approve, owner | 1 row |
| 3 | reverse invoice balance | CODE | approve, owner | 1 row, undo |
| 4 | notify customer | CODE | approve | 1 row |

```
 request -> read -> owner approves?
                         |
               no -------+------> stop, card shows declined
                         |
                        yes
                         |
                         v
              create refund -> reverse balance -> notify
```

## D3. Store publish - handloom saree shop

Merchant: handloom silk sarees, Kanchipuram. 42 items with photos. Proof "Silk Mark". Season "Pongal sale". Hours Mon-Sat 10-20.

```
 JEV #1
   models    products, booking
   industry  apparel
   required  header, hero, catalog, policy, booking, faq, contact, footer

 SHORTLIST (code)
   design    luxury, warm
   hero      split, commerce, typography
   catalog   grid, rail
   booking   list, tiers
   faq       disclosure
   optional  spotlight (season), trust (proof), story

 JEV #2
   design      luxury    0.79
   hero        commerce  0.81
   catalog     grid      0.88
   booking     list      0.74
   lead        spotlight 0.66
   spotlight   yes       0.88
   trust       yes       0.74
   story       no        0.42

 DRAFT (code)
   1 header     split
   2 spotlight  overlay      "Pongal sale"
   3 hero       commerce
   4 catalog    grid         42 items
   5 trust      row          "Silk Mark"
   6 booking    list         needs 1 service
   7 policy     disclosure
   8 faq        disclosure
   9 contact    whatsapp
  10 footer     contact-card

 GATE  FAIL (booking, contact)
       "add 1 bookable service with price"
       "add a contact phone"
       Draft saved, not published.
       Merchant adds both, draft regenerates, next tap publishes.
```

---

# PART E - EDGE DECISIONS

| Situation | Decision |
| :--- | :--- |
| Request maps to no action | Show one clear gap. Never a fake step |
| Request maps to two actions | Show top two as chips. One tap each |
| Confidence below threshold | Ask the merchant. Never guess silently |
| Required input missing | Gate becomes ask, at run time |
| Money or customer step | Gate becomes approve, approver becomes owner |
| Merchant edits a card | The edit wins and is remembered |
| Same request comes again | Remembered plan runs. No model |
| Model call fails | Fall back to code. Log it as a failure |
| Action fails mid-flow | Run stops, step marked, retry it |
| Same step tapped twice | Idempotency key. One effect |
| Two people edit one record | Version check. One wins, other reloads |
| Phone is offline | Tap queued locally, syncs later |
| Drawer does not match | Variance flagged to owner, one tap to audit |
| Stock would go negative | Write refused, never negative stock |
| Record is deleted | Archived with who and when |
| Owner changes money | One-tap undo writes opposite posting |
| Store changes under merchant | Draft regenerates. Never publishes itself |
| Merchant publishes | One tap. Only way a store goes live |
| Member leaves | Access withdrawn at once, history kept |
| Workspace is deleted | Records stay. Export first, then remove access |
| Scheduled flow misses its time | Runs late, once, says so |
| Two flows start on same event | One wins by idempotency key |
| Design library is empty | Default design for the industry is used |
| Recipe slot has no source | Section skipped, the gate lists it |
| Proof is missing | Trust section is not offered |
| Jev returns unknown option | Treated as no answer. Code decides |
| Costs reach monthly ceiling | Reads keep working, writes paused and reported |

---

# PART F - FLOW LIBRARY

A6 owns the grammar. This part is the reference set: one full trace, 45 domain flows, the shape map and the boundary.

## F1. Custom weave - full trace

| Input | Value |
| :--- | :--- |
| Brief | silk and cotton textiles, counter, ship across Tamil Nadu |
| User says | "show custom orders waiting and their value; make the flow from confirmed order to delivery" |
| Trigger | order created |
| Card | Custom Weave Orders |

| Choice | Answer |
| :--- | :--- |
| Card action | `order.create` |
| Metrics | open order count, open order value |
| Visibility | owner and admin |
| Steps | advance task, weave, fulfil, invoice, payment, dispatch |

| # | CRUD | Step | Gate | Mod |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Create | advance task | auto | - |
| 2 | Create | start weaving run | ask | - |
| 3 | Update | finish weaving, stock | ask | - |
| 4 | Update | fulfil order | ask | - |
| 5 | Create | issue invoice | approve | - |
| 6 | Create | record balance | approve | - |
| 7 | Create | dispatch and track | ask | - |

```
 +--------------------------------------+
 | [icon] CUSTOM WEAVE ORDERS   [OWNER] |
 |                                      |
 | Open 6        Value Rs. 126,000      |
 | Confirmed custom orders              |
 |                                      |
 | [ New Custom Order ]                 |
 +--------------------------------------+
```

```
tap [New Custom Order]
        |
        v
create order -> start flow
        |
        +-> step 1 auto: advance task
        |
        +-> step 2 asks: [Perform Step 2]
        |
        v
done -> card turns green
```

## F2. Domain flows

Each row is a composition of existing actions, not a new engine.

### Sales

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Quote follow-up | quote saved | Read quote -> Create task | ask | - | Open Quotes |
| Counter sale | tap | Create order -> Create payment -> Update stock | auto | - | Counter Sales |
| Bulk order | tap | Create order -> reserve stock -> Create invoice | auto | - | Bulk Orders |
| Unpaid quote chase | schedule | Read quotes -> message -> Create task | auto | repeat | Overdue Quotes |
| Daily sales report | schedule | Read sales -> Create delivery | auto | - | Sales Today |

### Marketing

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Lead follow-up | contact created | Read contact -> Create task -> message | ask | - | New Leads |
| Review request | shipment delivered | Read order -> message -> Create task | auto | - | Reviews |
| Festival campaign | schedule | Read contacts -> Create task -> message | auto | repeat each | Campaign |
| Website enquiry | site enquiry | Read enquiry -> Create task -> reply | ask | - | Enquiries |
| Repeat customer offer | schedule | Read orders -> Create task -> message | auto | repeat each | Repeat Customers |

### Support

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Ticket intake | message received | Create task -> assign -> reply | ask | - | Open Tickets |
| Refund request | tap | Read invoice -> Create refund -> Create task | approve | undo | Refunds |
| Warranty claim | tap | Read order -> Create task -> Create shipment | ask | - | Claims |
| SLA escalation | schedule | Read open tickets -> Create owner task | auto | repeat | Overdue Tickets |
| Feedback follow-up | task completed | message -> Create task | auto | - | Feedback |

### Money

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Cash close | schedule | Read payments -> count -> Create posting | ask | - | Cash Today |
| Overdue reminder | schedule | Read invoices -> message -> Create task | auto | repeat | Overdue |
| Expense capture | photo or tap | Create expense -> Create posting | auto | - | Expenses |
| Bank reconciliation | tap | Read statement -> match -> Update reconciliation | auto | match | Unreconciled |
| GST return | monthly | Read invoices -> Create report -> deliver | auto | repeat each | GST Due |

### Stock and purchase

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Low stock reorder | stock.low | Read stock -> Create purchase -> Create task | auto | - | Low Stock |
| Goods receipt | delivery | Read purchase -> Update stock -> Create receipt | auto | match | Inbound |
| Stock count | schedule | Read stock -> Create adjustment | ask | - | Stock Count |
| Transfer | tap | Read stock -> Update stock -> Create movement | auto | - | Transfers |
| Supplier payment | schedule | Read payables -> Create payment | approve | - | Payables |

### Production

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Start run | tap | Read recipe -> Create production -> Update materials | ask | - | Active Runs |
| Finish run | tap | Update production -> Update stock -> Create posting | auto | - | WIP |
| Quality check | tap | Read production -> Create inspection -> Update stock | ask | - | QC |
| Scrap | tap | Create movement -> Update stock | auto | - | Scrap |
| Work order schedule | schedule | Read orders -> Create plan task | auto | repeat each | Work Orders |

### People

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Shift handover | schedule | Read shift -> Create task -> Create note | ask | - | Handover |
| Attendance | tap | Create attendance | auto | - | Attendance |
| Payroll | monthly | Read attendance -> Create payroll -> Create payment | approve | - | Payroll |
| Leave request | event | Read member -> Create task -> Update attendance | ask | - | Leave |
| Onboarding | member invited | Create document task -> Create training task | auto | repeat each | Onboarding |

### Delivery

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Pack order | order paid | Read order -> Create pack -> Update order | auto | - | To Pack |
| Dispatch | tap | Read order -> Create shipment -> message tracking | ask | - | Dispatch |
| Delivery confirm | courier event | Update shipment -> Create task | auto | - | Delivered |
| Failed delivery | failure event | Read shipment -> Create task -> reschedule | auto | retry | Failed |
| Route trip | schedule | Read shipments -> Create trip -> assign driver | auto | repeat each | Routes |

### Compliance

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| License expiry | schedule | Read licenses -> Create task | auto | repeat | Expiring |
| Document vault | tap | Create document | auto | - | Documents |
| Audit export | schedule | Read events -> Create report | auto | - | Audit |
| Backup check | schedule | Read backup -> Create task if failed | auto | retry | Backup |
| Statutory filing | schedule | Read financials -> Create report -> deliver | approve | - | Filing |

## F3. Shape to gate and modifier

| Shape | Gate | Modifier | Used by |
| :--- | :--- | :--- | :--- |
| straight | auto | - | report, sale, receipt, finish run, audit |
| ask | ask | - | count cash, stock count, dispatch, handover |
| approval | approve | - | refund, invoice, payroll, supplier payment, filing |
| retry | auto or ask | retry | failed delivery, backup check |
| loop | auto | repeat | unpaid quote, overdue reminder, SLA, license expiry |
| batch | auto | repeat each | campaign, repeat offer, GST, work orders, onboarding, routes |
| reconcile | auto | match | bank match, goods receipt |
| reverse | approve | undo | refund, cancel order |

## F4. Boundary

| Allowed | Not allowed |
| :--- | :--- |
| Compose any existing tool | Invent a tool or screen |
| Read from any allowed record | Model-written SQL |
| Create, update, archive | Hard delete |
| Trigger by tap, schedule, event | Auto step that moves money or messages a customer |
| Owner confirms once | Silent creation from chat |

---

```
                        TAR v4 - ONE CANVAS OS

  MERCHANT DESCRIBES ONCE
         |
    +----+----+
    | JEV #1  |  business -> models, industry, cards, flows
    +----+----+
         |  CODE shortlists designs + recipes (max 6)
    +----+----+
    | JEV #2  |  look -> design, recipe per type, optional sections
    +----+----+
         |
    CODE ASSEMBLES  Canvas + Flows + Site draft
         |
    GATE CHECK  -> fail: draft + missing list | pass: [Publish]
         |
    MEMBER WORDS "cashier, no price edits"
         |
    JEV grants -> Canvas filtered
         |
    EVERY TAP -> CHECK -> ONE RECORD -> EVENT -> INBOX -> EVERY CANVAS
         |
    EVERY RUN / RENDER -> 0 model calls

  LLM = words.  JEV = choices.  CODE = truth.
  Memory = confirmed plans.  Cache = hash(state).
  Offline = queued.  Delete = archived.  Mistake = undo.
```
