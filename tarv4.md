# TAR v4 - One Canvas OS

> Merchant describes the business once. The system puts the right cards on the Canvas.
> Every card is a saved read + one tap. Every tap writes one record. No model at render or run.

```
WORDS or TAP -> PLAN (LLM sketch + JEV pick + CODE wire) -> CARD -> GATE -> ONE RECORD -> EVERY CARD SYNC
```

| Part | Holds |
| :--- | :--- |
| A | Concept: words, lanes, kernel, cards, flows, access, inbox, Jev, ladder, commerce |
| B | Concept screens: canvas, card, flow, checkout, store, manager, inbox |
| C | The store: models, designs, recipes, gate |
| D | Three traces, lane by lane |
| E | Edge decisions |
| F | Flow library: one full trace, 45 domain flows, shape map, boundary |

---

# PART A - CONCEPT

## A1. The idea

```
  Aambal Neyvagam                            Owner
 +------------------------------------+
 | COUNTER SALES            SHIFT 14  |
 | Today Rs. 18,450  UPI Rs. 14,100   |
 | [ New Counter Sale ]               |
 +------------------------------------+
 | ORDERS  Pending 3  Shipped 11      |
 | [ Open Queue ]                     |
 +------------------------------------+
 | Only the cards you may use, now.   |
 +------------------------------------+
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

## A2. Words

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, cards, site. Shared Turso DB, `workspace_id` | Aambal Neyvagam |
| Canvas | Home stack: only the cards you may see, useful now | Cashier 4, owner 6 |
| Card | Saved read + one tap | Cash Drawer: Rs 4,350 + [Count] |
| Flow | Ordered, resumable steps. Max 12 | Evening Closing, 4 steps |
| Step | One registered action | count cash drawer |
| Record | Typed row in the one `records` table | item, stock, order, posting |
| Inbox | Personal to-act feed, mandatory per member | 2 waiting, 1 overdue |

Card shape: `{ title, metrics: [{ label, read }], action, reach }`. Shape is `action` or `flow`.

Implementation nouns (not surface words):

| Noun | Meaning | Example |
| :--- | :--- | :--- |
| Tool card | Card backed by one action. 18 of them | Counter Sales |
| Run | One execution of a flow | Run 104, step 2 of 4 |
| Action | The only thing that writes. 116 registered | `order.create` |
| Stage | Groups actions for the manager. 14 of them | Sell, Money, People |
| Posting | Balanced debit and credit written with a record | sale: debit cash, credit revenue |
| Role | What a member does. Jev reads it from plain English | Cashier |
| Reach | Risk of an action: `money`, `customer`, `data`, `none` | money |
| Memory | A confirmed plan in the `plans` table, reused later | daily report |

Trigger, Gate, Approver and Modifier exist only inside Flow (A6).

## A3. Lanes

Each lane has one job. A lane never crosses into another.

| Lane | Owns | Never |
| :--- | :--- | :--- |
| Code | numbers, money, counts, dates, gates, grants, the commit | asks a model for a derivable fact |
| Jev | which of N, how risky, how useful | writes prose, computes, grants, commits |
| LLM | words, layout, prose | picks ids, decides, computes |

Pipeline: `WORDS or TAP -> PLAN -> CARD -> GATE -> RECORD -> every card syncs`. The gate checks token, grant, version and idempotency.

## A4. Kernel

| Verb | Meaning |
| :-: | :--- |
| C create | one new record |
| R read | count, sum, list, report. Projections are read-only |
| U update | one new version of a record |
| D delete | archive. Never erase |

| Record | Writes | Also writes |
| :--- | :--- | :--- |
| sale | order, invoice, payment | posting (debit cash, credit revenue), stock |
| expense | expense | posting |
| stock move | inventory | - |
| member | member | - |
| flow run | run, step pointer | - |

P&L, GST, forecast and stock on hand are computed by code from records. Never by a model.

## A5. Cards

Tap the title for detail. Tap the button to commit once (gate, then one record). Other actions live in detail.

| Preset | Shape | Opens | Example |
| :--- | :--- | :--- | :--- |
| tool | action | list, search, detail | Products, Stock |
| flow | flow | checklist run | Evening Closing |
| site | action | store preview, edit | Online Store |
| channel | action or read | feed or chat | WhatsApp |
| human | action | task list | Manual Tasks |

Surfaces: **Canvas** (home), **Flows** (active runs), **Site** (storefront), **You** (profile, workspaces), **Inbox** (to-act feed, mandatory).

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

A step is: `crud` (C, R, U or D), one registered `tool`, `input` (known at plan time or asked at run), `gate`, `approver`, `mod`.

| Trigger | Fires when |
| :--- | :--- |
| tap | a person presses the card |
| schedule | a clock: "every day at 22:00" |
| event | a record changes: "when an order is paid" |

| Gate | Who acts | When |
| :--- | :--- | :--- |
| auto | code | inputs known AND reach is `none` or `data` |
| ask | person | input missing, or physical step |
| approve | owner or admin | money, customer, or over limit |

Code upgrades the gate on the safety floor: auto + money becomes approve.

| Modifier | Meaning | Scope | Limit |
| :--- | :--- | :--- | :--- |
| retry | run again on failure | step | 3 tries, backoff 2^n s |
| repeat | until state changes, or per row | flow or row | 100 rows or 5 min |
| undo | opposite posting | step | undo failure needs owner approval |
| match | read two sources, update the match | plan | - |

Every flow is one of these eight forms:

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

JEV picks tool, gate and modifier. CODE checks the tool supports them, else falls back to a derived gate and modifier.

### Runtime is deterministic

TAP, SCHEDULE or EVENT -> GATE -> CRUD -> EVENT -> INBOX -> CANVAS SYNCS.

| Rule | Meaning |
| :--- | :--- |
| No model on render | cards read records and metrics |
| No model on run | steps are deterministic |
| One write | one step commits alone |
| Retry safe | same run + step never doubles |
| Reversible | one-tap undo |

## A7. Access

```
 visible card = workspace enabled
              AND Jev grant for this member
              AND card is useful now
```

Roles are never picked from a dropdown. Grants are derived, not assigned.

| Card or action | Owner | Admin | Cashier | Guest |
| :--- | :---: | :---: | :---: | :--- |
| Counter Sales (pos) | Full | Full | Execute only | Denied |
| Cash Drawer (register) | Full | Full | Shift only | Denied |
| Revenue Summary | Full | Full | Hidden | Denied |
| Order Packing (order) | Full | Full | Full | Denied |
| Pricing and Catalog | Full | Full | View only | Denied |
| Storefront Studio | Full | Full | View only | Public view |
| Team and Grants | Full | Full | Hidden | Denied |

Full = see and act. Execute only = act, no settings. View only = see only.
Shift only = act in a shift. Hidden = not shown. Denied = no access.

One person may belong to several workspaces. Each is isolated.

## A8. Inbox

Inbox shows only what this member can act on now. Screens: B9.

Filter by role, shift and reach. Sort by overdue, reach, due and assignment. Show only what this member can act on now.

| Event | Owner | Cashier |
| :--- | :---: | :---: |
| Refund approval needed (money, owner only) | yes | - |
| Count cash drawer (assigned to cashier) | yes | yes |
| Low stock alert | yes | - |
| Pack order | yes | yes |
| Cash drawer mismatch | yes | - |

Same 18 events: owner sees 6, cashier sees 2.

Sort order:

1. Overdue + high reach (money, customer first)
2. Due now + assigned to you
3. Due today + you can act
4. Later + background alerts

Three actions only: **Complete** (writes the record, archives the event), **Defer** (1 hour, tomorrow, next week), **Assign** (owner or admin). No delete. Events stay in history.

```
inbox_items (Turso)
  workspace_id, member_id, event_id
  reach         money | customer | data | none
  due_at, assigned_to, deferred_until
  status        pending | deferred | completed | archived
```

On event write, code computes the inbox rows for every eligible member. Members read their own rows.

Overflow: 200+ overnight events collapse by type ("3 low stock alerts"). Non-urgent items go to Later. Owner sees a summary: "47 waiting, 12 need you".

## A9. Where Jev decides

One request carries many questions. Jev answers them in one batched call.

| Type | Ask | Use for | Never |
| :--- | :--- | :--- | :--- |
| CHOICE | pick one of N | tool, variant, design, recipe, next card | N large: split into levels |
| NOUL | how likely yes | risk, gap, needed, useful, normal | compute anything |
| SCORE | where on a ladder | tier, quality, urgency | an exact number |

| # | Judgment | Type |
| :-: | :--- | :--- |
| 1 | Cards this workspace needs | CHOICE over 18 |
| 2 | Cards this member may see | NOUL per card |
| 3 | Job this member does | CHOICE over roles |
| 4 | Action this request means | CHOICE over registry |
| 5 | Action each flow line means | CHOICE per line, batched |
| 6 | Variant of this product | CHOICE over variants |
| 7 | Is this step needed | NOUL per step |
| 8 | Is the plan complete | NOUL |
| 9 | Does an action already do this | NOUL |
| 10 | Is this card useful now | NOUL per card |
| 11 | Next card for this role | CHOICE over 6 |
| 12 | Urgency for this role | SCORE over 3 |
| 13 | Is this order amount normal | NOUL |
| 14 | Which commerce models | NOUL per model |
| 15 | Which trade | CHOICE over 9 |
| 16 | Which capabilities | CHOICE x4 |
| 17 | Which design | CHOICE over 6 |
| 18 | Which recipe per section | CHOICE per type |
| 19 | Spotlight, story, trust | NOUL x3 |

Rules:

1. Never ask for an id the model did not see. Code shortlists, the model selects.
2. Models never compute a number, a count, a total, or compare dates.
3. Send only what the question reads.
4. Cache on model version + question version + the exact state read.
5. Pin the model id, not the alias.
6. Every deep answer graduates to the fast path.
7. Money or customer always needs a confirm. Not model decided.

Never modelled: ids from prose, money and stock maths, date compares, posting balance, access grants, publish decisions, layout tokens, HTML render.

Act on p(chosen) and margin, never on confidence alone. A small margin means ambiguous, so ask.

## A10. Certainty ladder

Never pay for a decision that needs no model. Each rung has one exit test.

```
 WORDS / TAP
   |
   v
 [L0] LITERAL  exact match to a known intent ---------> plan     0 calls
   |  no match
   v
 [L1] MEMORY   same shape as a saved plan ------------> plan     0-1 calls
   |  no near match
   v
 [L2] PROSE    LLM: the steps, in words  ----------->            1 call
   |
   v
 [L3] DECIDE   Jev: tool, variant, risk, rank -------->           1 batched
   |
   v
 [L4] VERIFY   Jev: does each step match? ------------>           1 batched
   |
   v
 [L5] CONFIRM  human approves the plan
   |
   v
 [COMPILE] -> card -> [RUN] 0 model calls, forever
```

| Rung | Who | Calls | Exit test |
| :--- | :--- | :---: | :--- |
| L0 Literal | code | 0 | exact match, compile |
| L1 Memory | code + Jev | 0-1 | near match, fill the slots |
| L2 Prose | LLM | 1 | always goes to L3 |
| L3 Decide | Jev | 1 batched | p and margin pass, go to L4 |
| L4 Verify | Jev | 1 batched | all steps yes, go to L5 |
| L5 Confirm | human | 0 | approve, compile |

A plan is remembered by its shape, not its words. "Every day at 10 send a sales report" and "send me a sales report at 10 every morning" are one plan.

```
plans (Turso)
  workspace_id, shape_hash   hash of (trigger type + action sequence)
  steps, trigger             compiled steps; tap | schedule | event
  confirmed_at               when the owner approved
  accuracy_score             per workspace, tunes thresholds
```

Lookup: hash the request shape, exact match in `plans`, reuse. No match goes to L2.

Auto-act thresholds by risk:

| Risk | Auto only if | Else |
| :--- | :--- | :--- |
| none, data | p >= 0.60, margin >= 0.30 | ask |
| customer | p >= 0.80, margin >= 0.40 | confirm |
| money | p >= 0.85, margin >= 0.50 | confirm + owner |

## A11. Commerce kernel

One shared kernel serves retail, restaurant, supermarket, delivery, taxi and services. A domain adds facts and actions. It never forks inventory, orders, payments or accounting.

```
BUY    supplier -> purchase -> receive -> on hand
SELL   customer -> order -> reserve -> fulfil -> invoice -> payment -> refund
                                                     |
                                      balanced postings (every event)
```

### Rules

| Topic | Rule |
| :--- | :--- |
| Money | integer minor units + ISO currency |
| Quantity | integer base units. Display conversion belongs to the product unit |
| Price | server resolved from an active price record |
| Stock | `available = onhand - reserved`, never negative |
| Snapshots | orders and invoices freeze commercial facts |
| Mutation | registered action + permission + idempotency key + audit event |
| Postings | every business event is balanced, checked before commit |
| Isolation | every record belongs to one workspace |

### Records

Commerce uses the shared `records` table. `type` selects the contract, `data` holds versioned fields. No table is created per trade.

| Type | Core fields | States |
| :--- | :--- | :--- |
| `item` | name, unit, tax, status | active, archived |
| `variant` | item, sku, barcode, attributes. Max 50 per item | active, archived |
| `price` | variant, amount, currency, channel, starts, ends | active, archived |
| `stock` | variant, location, onhand, reserved | active |
| `purchase` | supplier, lines, currency, totals | draft, ordered, partial, received, cancelled |
| `order` | customer, lines, totals, channel | draft, accepted, fulfilled, cancelled |
| `invoice` | party, order, lines, totals, due | issued, partial, paid, void |
| `payment` | invoice, amount, method, provider, reference | recorded, reversed |
| `refund` | payment, amount, reason, reference | recorded |
| `posting` | account, debit, credit, source | posted |
| `plan` | workspace_id, shape_hash, steps, trigger, confirmed_at | active, archived |

Files and text over 2KB live in R2. The record keeps the key, hash, size, media type and version. Stock, price, quantity, totals and payment state never live only in R2.

### Actions

| Action | Commits |
| :--- | :--- |
| `catalog.item.save` | create or revise an item |
| `catalog.variant.save` | create or revise a sellable variant |
| `price.set` | add an effective price |
| `stock.adjust` | audited stock correction |
| `purchase.create` | purchase with exact lines |
| `purchase.receive` | receive lines, increase stock, atomically |
| `order.create` | snapshot prices, reserve stock |
| `order.fulfill` | consume reserved stock |
| `order.cancel` | release unfulfilled reservation |
| `invoice.issue` | receivable from exact order facts |
| `payment.record` | settle all or part of an invoice |
| `refund.record` | refund within the paid balance |

POS reuses these actions for counter work: server pricing, returns, register and stock controls.

### Atomic commits

```
PURCHASE RECEIPT   validate remaining qty -> raise received -> +stock -> set status -> event
                   over-receipt rejects the whole transaction

CUSTOMER ORDER     read prices + stock -> lines, tax, total -> reserve every line -> snapshot -> event
                   any unavailable line rejects the order

INVOICE -> PAYMENT -> REFUND
  invoice.issue   debit receivable, credit revenue + tax
  payment.record  debit cash or provider, credit receivable
  refund.record   reversal bounded by paid balance
  unbalanced      validate_postings() rejects before commit, nothing written
```

Provider and bank references are evidence, not authority. Adapters normalise and deduplicate them, then call the Gateway.

### Domains

| Domain | Reuses | Adds |
| :--- | :--- | :--- |
| Restaurant | variants, stock, order, payment | stations, course timing, table and delivery handoff |
| Supermarket | catalog, barcode, price, POS | scales, batches, expiry, promotions |
| Delivery | order, payment | pickup, route, proof, settlement |
| Taxi | customer, service order, payment | trip, fare meter, route, driver state |
| Sales team | customer, order, invoice | lead, quote, approval, commission |
| Services | item, order, invoice, payment | booking, time, milestone, acceptance |

### Views and storage

Projections show each actor only what their role and action policy allow.

| Actor | Sees |
| :--- | :--- |
| Owner | accept, reject, exceptions, refund review |
| Kitchen or station | assigned lines and prep state |
| Courier | reach, collect, deliver, proof |
| Customer | pay, receive, rate |

The parent record is canonical. Projections are never truth.

| Need | Store |
| :--- | :--- |
| live title, price, availability | Turso records, through a public binding |
| product image, long description | R2 object, referenced by variant or item |
| invoice facts and status | Turso invoice, payment, posting |
| rendered invoice PDF | immutable R2 artifact, with hash and version |
| compiled public pages | site release bucket |

The site never stores inventory as its own truth. `site.refresh` rebuilds catalog bindings from active variants and prices. A public checkout, when enabled, calls the same order and payment actions.

### Failure recovery

| Failure | Recovery |
| :--- | :--- |
| client retries | same key + same hash returns the committed result |
| same key, changed input | conflict |
| provider repeats a webhook | unique provider + reference + operation key |
| worker stops after commit | replay the stored result, never repeat the effect |
| partial multi-record write | transaction rolls back |
| unbalanced postings | rejected before commit |

Reports (orders, stock, payments, postings) are projections or artifacts, never editable truth.

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
| 1 | Store Studio | owner |
| 2 | Describe once | owner |
| 3 | Building | code |
| 4 | Draft editor | owner |
| 5 | Gate | code |
| 6 | Publish confirm | owner |
| 7 | Storefront | customer |
| 8 | Item | customer |
| 9 | Cart and checkout | customer |
| 10 | Order placed | code |

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
| 1 | understand goal, trigger, slots | LLM |
| 2 | pick action, gate, trigger | JEV |
| 3 | step needed, plan complete | JEV |
| 4 | wire inputs, derive gate | CODE |
| 5 | owner confirms | HUMAN |
| 6 | save the plan | CODE |
| 7 | read sales | CODE |
| 8 | create the delivery | CODE |

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
