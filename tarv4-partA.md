# TAR v4 - PART A (SCREENS AND TABLES)

> Concept only. Tables and ASCII. Same content as tarv4.md Part A.

## A1. The idea: home screens

Owner Canvas (one card per task, only what this person may use):

```
+--------------------------------------------+
| Aambal Neyvagam                      Owner |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | COUNTER SALES        SHIFT 14        |  |
|  | Today Rs. 18,450   UPI Rs. 14,100    |  |
|  |                                      |  |
|  | [ New Counter Sale ]                 |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | ORDERS          Pending 3            |  |
|  | Shipped 11                           |  |
|  |                                      |  |
|  | [ Open Queue ]                       |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| Only the cards you may use, now.           |
+--------------------------------------------+
```

Cashier Canvas (same app, fewer cards):

```
+--------------------------------------------+
| Aambal Neyvagam                    Cashier |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | COUNTER SALES        SHIFT 14        |  |
|  | Bills 9   Drawer Rs. 4,350           |  |
|  |                                      |  |
|  | [ New Counter Sale ]                 |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | INBOX          2 waiting, 1 overdue  |  |
|  |                                      |  |
|  | [ Open Feed ]                        |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | SHIFT HANDOVER FLOW     16:00        |  |
|  | Not started                          |  |
|  |                                      |  |
|  | [ Start Handover ]                   |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| Grants: Counter Sales, Cash Drawer, Inbox  |
+--------------------------------------------+
```

Seven laws:

| # | Law |
| :-: | :--- |
| 1 | Every event writes balanced debit and credit |
| 2 | Stock never negative: available = on hand - reserved |
| 3 | Nothing erased. Archive only, log who, when, what |
| 4 | One registry. New trade = new action + new record type, never a table |
| 5 | Money or customer needs one confirm |
| 6 | Every owner tap has one-tap undo |
| 7 | No model on run. Cards and runs are deterministic |

## A2. Words

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, cards, site. One shared DB, `workspace_id` | Aambal Neyvagam |
| Canvas | Home stack: only the cards you may see, useful now | Cashier 4, owner 6 |
| Card | Saved read + one tap | Cash Drawer: Rs 4,350 + [Count] |
| Flow | Ordered, resumable steps. Max 12 | Evening Closing, 4 steps |
| Step | One registered action | count cash drawer |
| Record | Typed row in the one `records` table | item, stock, order, posting |
| Inbox | Personal to-act feed, mandatory per member | 2 waiting, 1 overdue |

Card shape: `{ title, metrics: [{ label, read }], action, reach }`. Shape is `action` or `flow`.

Implementation nouns:

| Noun | Meaning | Example |
| :--- | :--- | :--- |
| Tool card | Card backed by one action | Counter Sales |
| Run | One execution of a flow | Run 104, step 2 of 4 |
| Action | The only thing that writes | `order.create` |
| Stage | Groups actions for the manager | Sell, Money, People |
| Posting | Balanced debit and credit written with a record | sale: debit cash, credit revenue |
| Role | What a member does. Jev reads it from plain English | Cashier |
| Reach | Risk of an action: `money`, `customer`, `data`, `none` | money |
| Memory | A confirmed plan in the `plans` table, reused later | daily report |

Trigger, Gate, Approver and Modifier exist only inside Flow (A6).

## A3. Lanes

| Lane | Owns | Never |
| :--- | :--- | :--- |
| Code | numbers, money, counts, dates, gates, grants, the commit | asks a model for a derivable fact |
| Jev | which of N, how risky, how useful | writes prose, computes, grants, commits |
| LLM | words, layout, prose | picks ids, decides, computes |

```
WORDS or TAP -> PLAN -> CARD -> GATE -> RECORD -> every card syncs

PLAN    LLM sketches, Jev picks, Code wires
GATE    token, grant, version, idempotency
RECORD  one row, then every card syncs
```

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

```
+--------------------------------------------+
| < Back                       COUNTER SALES |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | Today   Rs. 18,450   bills 14        |  |
|  | UPI     Rs. 14,100                   |  |
|  | Cash    Rs.  4,350                   |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| RECENT BILLS                               |
|                                            |
| #1042  Senthamizh                Rs. 1,250 |
| #1041  walk-in                   Rs.   480 |
| #1040  Kanimozhi                 Rs. 2,100 |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | [ New Counter Sale ]                 |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
```

| Preset | Shape | Opens | Example |
| :--- | :--- | :--- | :--- |
| tool | action | list, search, detail | Products, Stock |
| flow | flow | checklist run | Evening Closing |
| site | action | store preview, edit | Online Store |
| channel | action or read | feed or chat | WhatsApp |
| human | action | task list | Manual Tasks |

| Surface | Holds |
| :--- | :--- |
| Canvas | home: cards you may use, useful now |
| Flows | active runs and available flows |
| Site | storefront preview, edit, publish |
| You | profile, settings, workspaces |
| Inbox | to-act feed (mandatory) |

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

```
+--------------------------------------------+
| Evening Closing                    Run 104 |
+--------------------------------------------+
| Step 2 of 4 - ask                          |
+--------------------------------------------+
| [x] 1  Print daily sales           auto    |
| [>] 2  Count cash drawer           ask     |
| [ ] 3  Note mismatch               auto    |
| [ ] 4  Close shift                 approve |
+--------------------------------------------+
|  +--------------------------------------+  |
|  | [ Count Cash ]                       |  |
|  +--------------------------------------+  |
+--------------------------------------------+
```

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

Every flow is one of eight forms:

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

Jev picks tool, gate and modifier. Code checks the tool supports them, else falls back to a derived gate and modifier.

### Runtime is deterministic

```
TAP, SCHEDULE or EVENT -> GATE -> CRUD -> EVENT -> INBOX -> CANVAS SYNCS
```

| Rule | Meaning |
| :--- | :--- |
| No model on render | cards read records and metrics |
| No model on run | steps are deterministic |
| One write | one step commits alone |
| Retry safe | same run + step never doubles |
| Reversible | one-tap undo |

## A7. Access

A card is visible only when all three hold:

```
 workspace enabled
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

Inbox shows only what this member can act on now. Filter by role, shift and reach. Sort by overdue, reach, due and assignment.

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

Owner inbox:

```
+--------------------------------------------+
| INBOX                              6 of 18 |
+--------------------------------------------+
| URGENT - NEEDS APPROVAL                    |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | ! Refund Rs. 2,000   Customer #89    |  |
|  | Reason: damaged item                 |  |
|  |                                      |  |
|  | [ Approve ]                          |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| OVERDUE                                    |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | Cash drawer mismatch  Rs. 350        |  |
|  | Kanimozhi's count                    |  |
|  |                                      |  |
|  | [ Audit ]                            |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| TODAY                                      |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | Low stock: 3 items                   |  |
|  |                                      |  |
|  | [ Review ]                           |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| + 12 handled by staff (hidden)             |
+--------------------------------------------+
```

Cashier inbox:

```
+--------------------------------------------+
| INBOX                              2 of 18 |
+--------------------------------------------+
| OVERDUE                                    |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | ! Count cash drawer    Shift 14      |  |
|  | Due 3:45 pm                          |  |
|  |                                      |  |
|  | [ Complete ]                         |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| NOW                                        |
+--------------------------------------------+
|                                            |
|  +--------------------------------------+  |
|  | Pack order for Senthamizh            |  |
|  | 2 items   pickup 4:30 pm             |  |
|  |                                      |  |
|  | [ Complete ]                         |  |
|  +--------------------------------------+  |
|                                            |
+--------------------------------------------+
| 16 other tasks hidden (not your role)      |
+--------------------------------------------+
```

Storage:

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

| Rule | Meaning |
| :-: | :--- |
| 1 | Never ask for an id the model did not see. Code shortlists, the model selects |
| 2 | Models never compute a number, a count, a total, or compare dates |
| 3 | Send only what the question reads |
| 4 | Cache on model version + question version + the exact state read |
| 5 | Pin the model id, not the alias |
| 6 | Every deep answer graduates to the fast path |
| 7 | Money or customer always needs a confirm. Not model decided |

| Never modelled |
| :--- |
| ids from prose, money and stock maths, date compares, posting balance |
| access grants, publish decisions, layout tokens, HTML render |

| Signal | Use |
| :--- | :--- |
| p(chosen) | act above threshold, else ask |
| margin = p(top1) - p(top2) | small margin = ambiguous, ask |

Act on p(chosen) and margin, never on confidence alone.

## A10. Certainty ladder

Never pay for a decision that needs no model. Each rung has one exit test.

```
 WORDS / TAP
   |
   v
 [L0] LITERAL  exact match to a known intent ---------> plan      0 calls
   |  no match
   v
 [L1] MEMORY   same shape as a saved plan ------------> plan      0-1 calls
   |  no near match
   v
 [L2] PROSE    LLM: the steps, in words  -------------->          1 call
   |
   v
 [L3] DECIDE   Jev: tool, variant, risk, rank -------->          1 batched
   |
   v
 [L4] VERIFY   Jev: does each step match? ------------>          1 batched
   |
   v
 [L5] CONFIRM  human approves the plan
   |
   v
 [COMPILE] -> card -> [RUN]   0 model calls, forever
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

Records. Commerce uses the shared `records` table. `type` selects the contract, `data` holds versioned fields. No table is created per trade.

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

Atomic commits:

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

| Domain | Reuses | Adds |
| :--- | :--- | :--- |
| Restaurant | variants, stock, order, payment | stations, course timing, table and delivery handoff |
| Supermarket | catalog, barcode, price, POS | scales, batches, expiry, promotions |
| Delivery | order, payment | pickup, route, proof, settlement |
| Taxi | customer, service order, payment | trip, fare meter, route, driver state |
| Sales team | customer, order, invoice | lead, quote, approval, commission |
| Services | item, order, invoice, payment | booking, time, milestone, acceptance |

| Actor | Sees |
| :--- | :--- |
| Owner | accept, reject, exceptions, refund review |
| Kitchen or station | assigned lines and prep state |
| Courier | reach, collect, deliver, proof |
| Customer | pay, receive, rate |

Projections show each actor only what their role allows. The parent record is canonical. Projections are never truth.

| Need | Store |
| :--- | :--- |
| live title, price, availability | Turso records, through a public binding |
| product image, long description | R2 object, referenced by variant or item |
| invoice facts and status | Turso invoice, payment, posting |
| rendered invoice PDF | immutable R2 artifact, with hash and version |
| compiled public pages | site release bucket |

The site never stores inventory as its own truth. `site.refresh` rebuilds catalog bindings from active variants and prices. A public checkout, when enabled, calls the same order and payment actions.

| Failure | Recovery |
| :--- | :--- |
| client retries | same key + same hash returns the committed result |
| same key, changed input | conflict |
| provider repeats a webhook | unique provider + reference + operation key |
| worker stops after commit | replay the stored result, never repeat the effect |
| partial multi-record write | transaction rolls back |
| unbalanced postings | rejected before commit |

Reports (orders, stock, payments, postings) are projections or artifacts, never editable truth.
