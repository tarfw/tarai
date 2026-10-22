# TAR - Canvas

> The workspace is a **Canvas of Cards**. A Card is a saved read and one tap.
> Flows are ordered steps of Cards. **Jev decides. LLM writes. Code commits.**

```
A DRAWER OF TOOLS                A CANVAS OF CARDS
+----------------------+          +----------------------+
| [pos] [order]        |          | Counter Sales        |
| [cash] [store]       |   ->     | Rs. 18,450  UPI      |
| [flow] [stock]       |          | [ New Sale ]         |
| [chat] [telegram]    |          | 14 bills, cash 4,350 |
+----------------------+          +----------------------+
same for everyone                 your job, now, one tap
```

## Section map

| Section | Holds |
| :--- | :--- |
| A | Concept: words, lanes, surfaces, card, flow, access, laws, Jev map, rules, ladder, status |
| B | Concept screens: canvas, card, flow, checkout, store, manager |
| C | The store: models, designs, recipes, publish gate |
| D | Three examples, lane by lane |
| E | Edge decisions |

Markers used throughout: `[S]` shipped in code, `[P]` partly shipped, `[T]` target.
Nothing here describes an unbuilt feature as if it exists.

---

# PART A - CONCEPT

## A1. The words

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, cards, site, one database | Aambal Neyvagam, Salem |
| Canvas | Home surface: only the cards allowed for you and useful now | Cashier sees 4, owner sees 6 |
| Card | Saved read plus one tap | Cash drawer: Rs. 4,350 + [Count Cash] |
| Tool card | A card backed by one action. 18 of them | Counter Sales |
| Flow | Ordered, resumable steps | Evening closing |
| Step | One action inside a flow | Count cash drawer |
| Run | One execution of a flow | Run 104, step 2 of 4 |
| Action | The only thing that writes. 116 of them | order.create |
| Stage | A tag that groups actions for the manager. 14 of them | Sell, Money, People |
| Record | Typed row in one records table | item, stock, order |
| Posting | Balanced debit and credit written with a record | sale: debit cash, credit revenue |
| Role | What a member does. Jev reads it from plain English | Member (Cashier) |
| Reach | Risk of an action: money, customer, data, none | money |
| Gate | Who acts on a step: auto or human | human |
| Approver | Who acts when the gate is human: the assignee or the owner | owner, for money |
| Modifier | How a step repeats or reverses: none, loop, undo | loop |
| Trigger | When a flow starts: tap, schedule, event | schedule 22:00 |
| Inbox | Personal to-act feed, one card per member | 2 waiting, 1 overdue |
| Memory | A confirmed plan, reused later | daily report pattern |

## A2. The four lanes

| Lane | Owns | Never |
| :--- | :--- | :--- |
| Deterministic (code) | numbers, money, counts, dates, gates, permissions | asks a model for a fact it can derive |
| Decision (Jev) | which of these N, how risky, how useful | writes prose, computes, grants, commits |
| Language (LLM) | the words, the layout, the prose | picks ids, decides, computes |
| Execution (code) | the commit, always | anything a model can influence |

A lane never crosses.

```
WORDS or TAP
     |
     v
  PLAN    LLM sketches, JEV picks, CODE wires
     |
     v
  CARD    saved read + one tap
     |
     v
  GATE    token, grant, version, idempotency
     |
     v
  RECORD  one row, then every card syncs
```

## A3. Surfaces

| Surface | Holds |
| :--- | :--- |
| Canvas | Home stack: cards allowed for you and useful now |
| Flows | Active runs and available flows |
| Site | Store preview, edit, publish |
| You | Profile, settings, workspaces |
| Inbox | Personal to-act card and feed. Mandatory for every member |

## A4. The card

```
CARD = saved read + one tap
2 shapes: action | flow
5 presets: tool | flow | site | channel | human
```

| Preset | Shape | Opens |
| :--- | :--- | :--- |
| tool | action | list, search, detail |
| flow | flow | checklist run |
| site | action | store preview and edit |
| channel | action or read | feed or chat |
| human | action | task list |

```
Tap title  -> opens detail
Tap button -> commits once
Card shows: title, up to 2 live metrics, one primary button
```

A card is data, never hand-built:

```
card = { title, metrics: [{label, read}], action, reach }
```

## A5. The flow

```
FLOW
  trigger   tap | schedule | event
  steps     [ step, step, ... ]   max 12
  card      title + 0-2 metrics + 1 tap

STEP
  action    one registered action
  input     known at plan time, or asked at run time
  gate      auto | human
  approver  assignee | owner
  modifier  none | loop | undo
```

Everything a flow can be is one of these forms. No other shape exists.

| Form | Gate | Approver | Modifier | Reads as |
| :--- | :--- | :--- | :--- | :--- |
| straight | auto | - | none | send a report |
| human | human | assignee | none | count the drawer |
| approval | human | owner | none | approve a refund |
| loop | auto | - | loop | chase every unpaid quote |
| batch | auto | - | loop, per row | message every contact |
| reverse | human | owner | undo | refund an invoice |
| retry | auto | - | none | retry is action error handling |
| reconcile | auto | - | none | reconcile is an action |

```
GATE = auto   only when the action reaches nothing risky
               and every required input is already known
       human  the step needs a person, or reaches money or customer

CODE derives the gate. Jev never overrides it.
```

```
TRIGGER
  tap       a person presses the card
  schedule  a clock. "every day at 22:00"
  event     a record changed. "when an order is paid"
```

## A6. Access

```
workspace enabled
  AND Jev grants for this member
  AND now
  = visible cards
```

Roles are never picked from a dropdown.

| Card or action | Owner | Admin | Member | Guest |
| :--- | :---: | :---: | :---: | :---: |
| Counter Sales | Full | Full | Execute only | Denied |
| Cash Drawer | Full | Full | Shift only | Denied |
| Revenue Summary | Full | Full | Hidden | Denied |
| Order Packing | Full | Full | Full | Denied |
| Pricing and Catalog | Full | Full | View only | Denied |
| Storefront Studio | Full | Full | View only | Public view |
| Team and Grants | Full | Full | Hidden | Denied |

```
Full = see and act        Execute only = act, no settings
Shift only = act in a shift      View only = see only
Hidden = not shown        Denied = no access
```

One person may be in several workspaces. Each is isolated.

## A7. The laws

| Law | Rule |
| :--- | :--- |
| 1 Balanced books | Every event writes matching debits and credits |
| 2 Stock never negative | Available = on hand - reserved, never below zero |
| 3 Nothing is erased | Every change appends who, when, what changed |
| 4 One registry | A new trade is a new action and a new record type, never a new table |
| 5 Owner safety floor | Money or customer needs one confirm |
| 6 Zero fear | Every owner tap is reversible with one-tap undo |
| 7 No model on run | Cards and runs are deterministic |

## A8. One tap, one truth

```
TAP
  |
  v
CHECK   token, grants, version, idempotency
  |
  v
ONE RECORD ROW   + postings
  |
  v
EVENT --> INBOX (role filtered) --> EVERY CANVAS SYNCS
```

| Situation | Behavior |
| :--- | :--- |
| Reads | pending orders, cash on hand, active runs |
| Offline | "Saved on phone, will sync when online" |
| Delete | archive, never erase |
| Undo | one tap, same record |
| Model on run | never |

## A9. Where Jev decides

Every judgment in the system, in one place. One request carries many questions.

| # | Judgment | Type | Replaces |
| :--- | :--- | :--- | :--- |
| 1 | Which cards does this workspace need | CHOICE over 18 | a module picker |
| 2 | Which cards may this member see | NOUL per card | a role dropdown |
| 3 | What job does this member do | CHOICE over work roles | a job dropdown |
| 4 | Which action does this request mean | CHOICE over the registry | intent regex |
| 5 | Which action does this flow line mean | CHOICE per line, batched | line regex |
| 6 | Which variant of this product | CHOICE over the variants | a variant picker |
| 7 | Is this step needed at all | NOUL per step | over-built flows |
| 8 | Is the plan complete | NOUL | half-built flows |
| 9 | Does any action already do this | NOUL | fake steps |
| 10 | Is this card useful now | NOUL per card | a fixed card list |
| 11 | Which card is next for this role | CHOICE over 6 cards | render-time ranking |
| 12 | How urgent is this for this role | SCORE over 3 levels | a fixed priority order |
| 13 | Is this order amount normal | NOUL | nothing yet. a fraud net |
| 14 | Which commerce models | NOUL per model | a model picker |
| 15 | Which trade | CHOICE over 9 | a trade picker |
| 16 | Which capabilities | CHOICE x4 | checkboxes |
| 17 | Which design | CHOICE over 6 shortlist | the default design |
| 18 | Which recipe per section type | CHOICE per type | the default recipe |
| 19 | Are spotlight, story, trust present | NOUL x3 | fixed sections |

Judgment 10 is the "now" in the access rule. Judgment 6 is the variant.

| Type | Ask | Use for | Never |
| :--- | :--- | :--- | :--- |
| CHOICE | pick one of N | tool, variant, design, recipe, next card | when N is large, split into levels |
| NOUL | how likely yes | risk, gap, needed, useful, normal | to compute anything |
| SCORE | where on a ladder | tier, quality, graded rank | to get an exact number |

```
ONE REQUEST
+---------------------------------------------------+
| state   filtered to what the questions need       |
|                                                   |
| q1  CHOICE  which tool?                           |
| q2  CHOICE  which variant?                        |
| q3  NOUL    does this move money?                 |
| q4  NOUL    is this card useful now?              |
| q5  SCORE   how urgent?                           |
+---------------------------------------------------+
          |
          v
   one batched call -> many typed answers
```

Batch freely. 13 questions in one call came out about 12x cheaper and 10x faster than
13 calls of one, with the same answers. The saving shrinks when the state is small, but
the round trips are saved either way.

```
NEVER MODELED
  ids from prose        money maths        stock maths
  date comparison       posting balance    access grants
  publish decisions     layout tokens      html render
  rollback
```

| Stage | Who | Job |
| :--- | :--- | :--- |
| Understand | LLM | goal, trigger, step phrases |
| Extract slots | LLM | time, target, report |
| Decide | Jev | action, gate, trigger, presence |
| Verify | Jev | step needed, plan complete, approval |
| Rank | Jev | best of two valid plans |
| Write | LLM | card name, description, report prose |
| Explain | LLM | why this plan, in plain words |
| Compute | Code | counts, sums, money, stock |
| Commit | Code | gate, version, idempotency, record |

## A10. The rules

1. Never ask for an id the model did not see. Shortlist in code, let the model select.
2. Never let a model compute a number, a count, a total, or compare dates.
3. One request, many questions. Never one request per question.
4. Send only what the question needs. Extra detail is noise, not context.
5. Cache on (model version + question version + the exact state that question reads).
6. Pin the model id, not the alias. Aliases move under you.
7. Every deep path answer must graduate to the fast path, or the bill never drops.
8. Money or customer = confirm. Always. Not model decided.
9. A lane never crosses. The model never commits, never grants, never computes.

| Bad | Why | Instead |
| :--- | :--- | :--- |
| model picks the gate | policy, not judgement | derive from reach |
| model picks ids from memory | hallucination | shortlist in code first |
| one call writes and decides | mixed lanes | split into prose, then decide |
| one call per question | n x cost, n x latency | batch into one |
| confidence above .6, auto | confidence is not correctness | use p + margin |
| retry until it works | unbounded cost | one targeted repair |
| big state, one question | distractor | filter the state in code |
| a regex router instead of a model | many branches to keep, and wrong | one choice over the registry |
| a model call on a render path | it blocks the screen | precompute it |

## A11. The certainty ladder

Never pay for a decision you could have made without a model. Every request walks
down a fixed ladder. Each rung has one exit test.

```
 WORDS / TAP
     |
     v
 [L0] LITERAL -------------------------------------> plan          0 calls
     |  no match
     v
 [L1] MEMORY  -------------------------------------> plan          0-1 calls
     |  no near match
     v
 [L2] PROSE   (LLM)   step phrases --------------->               1 call
     |
     v
 [L3] DECIDE  (Jev)   tool / variant / risk /     -->               1 call
     |                rank / gap
     v
 [L4] VERIFY  (Jev)   does each step match? ------>               1 call
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

A plan is remembered by the shape of the request, not its words. "every day at 10 send
a sales report" and "send me a sales report at 10 every morning" are one plan.

Every answer on the deep path must graduate up. A plan that keeps paying for L2 to L4
will never get cheaper on its own.

```
0 model calls on a card render
0 model calls on a flow run
0 model calls on a scheduled run
0 model calls on a publish
```

## A12. Reading a Jev answer

```
 p(chosen)   0.86  ---.
 p(top2)     0.11  ---+---> margin = 0.75   confident
 confidence  0.41  ---'                      -> act
```

| Signal | Meaning | Use |
| :--- | :--- | :--- |
| p(chosen) | chance the pick is right | above threshold, act. else ask |
| margin | p(top1) - p(top2) | small margin, ambiguous, ask |
| confidence | how concentrated the spread is | only to detect a spread out answer |

Never auto-act on confidence alone.

| Request | Naive | Ladder |
| :--- | :---: | :---: |
| known intent | 3 calls | 0 |
| similar intent | 3 calls | 1 |
| new intent | 5 calls | 3 |
| every run afterwards | 3 calls | 0 |
| a card's glance value | a model call | a materialized read |

## A13. Status

| Area | Shipped | Still target |
| :--- | :--- | :--- |
| Actions, records, postings, stock floor, archive | `[S]` | - |
| 18 tool cards, roles, per-member grants | `[S]` | - |
| Flows: run, step, resume, idempotency, versioning | `[S]` | - |
| Flow grammar | `[P]` auto only | gate, approver, modifier, trigger, crud |
| One registry | `[P]` actions and cards separate | stage, reach, card flag on one list |
| Card metrics and the Canvas screen | `[P]` server builds cards | live metrics, add-card, tabs |
| Jev | `[S]` 8 call sites, 7-day cache on the store | cache everywhere, plan memory |
| The store | `[S]` | a larger design library |

---

# PART B - CONCEPT SCREENS

## B1. The Canvas, owner

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

## B2. The Canvas, staff

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

## B6. Add a card

```
+--------------------------------------------+
| < Back                            Add Card |
+--------------------------------------------+
| TOOL CARDS - role: Owner                   |
| [x] Counter Sales                          |
| [x] Cash Drawer                            |
| [x] Orders and Shipping                    |
| [x] Online Store                           |
| [ ] Stock and Low Inventory   [ + ]        |
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

## B7. The store

```
+--------------------------------------------+
| < Back                        Online Store |
+--------------------------------------------+
| aambal.tar.site                       LIVE |
| Catalog 24 published                       |
| Visits this week 892                       |
+--------------------------------------------+
| TODAY                                      |
| Visits 142   Orders 6   Enquiries 8        |
+--------------------------------------------+
| [ View Store ]    [ Edit Products ]        |
+--------------------------------------------+
```

## B8. The manager

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
```

| Stage | Count | Lives in |
| :--- | :--- | :--- |
| Plan | 4 | projections and flows: forecast, S&OP, budgets, MRP |
| Source | 10 | purchase, contact: suppliers, RFQ, PO, GRN, AP, returns |
| Stock | 10 | inventory: ledger, locations, counts, transfers, batches |
| Make | 7 | recipe record and flow: BOM, work orders, scrap, QC, costing |
| Catalog | 4 | item: items, variants, units, channel price lists |
| Sell | 10 | pos, register, site: POS, register, print, offline, web store |
| Order | 7 | order, invoice: quotes, orders, reservations, GST, credit |
| Money | 16 | postings: ledger, AP/AR, bank rec, expenses, GST, assets, P&L |
| People | 7 | members and flow: staff, roles, shifts, attendance, payroll |
| Serve | 9 | contact: leads, pipeline, tickets, bookings, time billing |
| Move | 5 | order: carriers, routes, POD, fleet, trips |
| Comply | 4 | records: QC, licenses, statutory dates, document vault |
| Comms | 5 | inbox, whatsapp, telegram: tasks, flows, alerts |
| Manage | 12 | manager: dashboards, approvals, branches, backups, settings |

---

# PART C - THE STORE

The merchant describes the business once. The system builds the store.

```
BUILD TIME                        RUN TIME
--------------                    ------------------
designmds/*.md                   merchant description
  parse, validate, tag    ---->    |
  review by a person             JEV #1  business
  |                              code    shortlist, max 6
  v                              JEV #2  look
designs/index.json                  code    order, layout, gate
designs/tokens/<id>.json            |
                                   v
                                 draft
                                   |
                        gate fails -> draft + missing list
                        gate passes -> ready, the merchant taps
```

## C1. The models

Axis A, the model, drives sections and the publish gate. Axis B, the industry, drives copy and the design shortlist.

| Model | Money moves when | Required sections | Gate must have |
| :--- | :--- | :--- | :--- |
| products | customer buys an item | header, hero, catalog, policy, contact, footer | 1 item, contact |
| food | customer orders a meal | header, hero, menu, location, contact, footer | 1 menu item, contact, hours |
| booking | customer books a time | header, hero, booking, faq, contact, footer | 1 bookable service, contact |
| quote | customer asks for a price | header, hero, booking, faq, contact, footer | contact, enquiry route |
| digital | customer downloads or subscribes | header, hero, catalog, policy, faq, contact, footer | 1 priced item, contact |
| bulk | business buys in volume | header, hero, catalog, faq, contact, footer | 1 item, enquiry route, minimum order |

- A store can carry several models. Required sections are the union.
- Optional sections come from facts or a Jev yes/no.
- Code rejects an empty model set and asks the merchant when confidence is below 0.6.

## C2. The design library

```
designmds/*.md   (curated source, build input only)
      |
      |  parse, validate, tag, review
      v
designs/index.json     one row per design
designs/tokens/<id>.json
      |
      v
shortlist by model and industry, max 6
      |
      v
JEV #2 picks from the shortlist only
```

```
{ "id": "luxury", "tone": "light", "industries": ["apparel", "jewellery", "craft"],
  "models": ["products", "quote"], "density": "airy", "imagery": "editorial",
  "contrast": 4.9, "swatches": ["#ffffff", "#000000", "#3b281d", "#f7f4f1"] }
```

| Check | Rule |
| :--- | :--- |
| required tokens | paper, ink, surface, accent, radius, type scale present |
| units | every size in px or rem |
| contrast | body on paper, and paper on accent, at least 4.5:1 |
| id | one lowercase semantic word, unique across the library |
| tags | tone matches the palette |
| source | file hash and license note present |

## C3. The recipes

A recipe is data. It describes layout and slots, never copy or assets.

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
| overlay | media with content layer and scrim |
| rail | horizontal scroll strip with snap |
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

## C4. JEV in the store

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
| recipe, per section type | CHOICE | that type's shortlist | 0.55 |
| lead | CHOICE | spotlight, catalog, story | 0.55 |
| spotlight, story | NOUL | yes, no | 0.65 |
| trust | NOUL | only if proof exists | 0.65 |

Below threshold, code uses the default. Jev never invents an option.

## C5. Overrides and the gate

| Override | Stored as | Beats Jev |
| :--- | :--- | :--- |
| design | design id | yes |
| recipe per section | recipe id | yes |
| settings | values from the settings schema | yes |
| text | slot value | yes |
| section on or off | flag | yes, except required sections |

Overrides survive regeneration. Jev sees them as fixed picks, so it does not fight them.

```
CODE owns
  section order, layout grammar, the publish gate, checkout,
  payment, tax, shipping, SEO, prices, totals, stock

MERCHANT owns
  design, recipes, settings, text, publish

JEV owns
  which options, with a probability
```

---

# PART D - EXAMPLES

## D1. Daily sales report

```
every day at 10 am send me a sales report
```

| # | Step | Lane | Commits |
| :-: | :--- | :--- | :--- |
| 1 | understand goal, trigger, slots | LLM | - |
| 2 | pick action, gate, trigger | JEV | - |
| 3 | is the step needed, is the plan complete | JEV | - |
| 4 | wire inputs, derive gate | CODE | - |
| 5 | owner confirms | HUMAN | - |
| 6 | save the plan | CODE | memory |
| 7 | read sales | CODE | - |
| 8 | create the delivery | CODE | 1 row |

```
day 1   2 model calls
day 2+  0 model calls, the plan is remembered

10:00 -> read sales -> create delivery -> card shows the last run
```

```
+--------------------------------------+
| DAILY SALES REPORT                   |
| Last  today 10:00                    |
| Next  tomorrow 10:00                 |
| [ Run now ]                          |
+--------------------------------------+
```

## D2. Refund approval

```
refunds above Rs. 2,000 need my approval
```

| # | Step | Lane | Gate | Commits |
| :-: | :--- | :--- | :--- | :--- |
| 1 | read invoice and payment | CODE | auto | - |
| 2 | create refund | CODE | human, owner | 1 row |
| 3 | reverse invoice balance | CODE | human, owner | 1 row, undo |
| 4 | notify customer | CODE | human | 1 row |

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

## D3. Store publish for a handloom saree shop

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
  design      luxury   0.79
  hero        commerce 0.81
  catalog     grid     0.88
  booking     list     0.74
  lead        spotlight 0.66
  spotlight   yes      0.88
  trust       yes      0.74
  story       no       0.42

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

GATE  FAIL (booking): "add 1 bookable service with price"
      Draft saved, not published.
      The merchant adds the service, the draft regenerates,
      the next tap publishes.
```

---

# PART E - EDGE DECISIONS

| Situation | Decision |
| :--- | :--- |
| The request maps to no action | Show one clear gap. Never a fake step |
| The request maps to two actions | Show the top two as two chips. One tap each |
| Confidence below threshold | Ask the merchant. Never guess silently |
| A required input is missing | Gate becomes human, at run time |
| A money or customer step | Gate becomes human, approver becomes the owner |
| The merchant edits a card | The edit wins, and it is remembered |
| The same request comes again | The remembered plan runs. No model |
| A model call fails | Fall back to code. Log it as a failure, not as a decision |
| An action fails mid-flow | The run stops, the step is marked, retry it |
| The same step is tapped twice | Idempotency key. One effect |
| Two people edit the same record | Version check. One wins, the other is told to reload |
| The phone is offline | The tap is queued locally, syncs later, shows the same card |
| The drawer does not match | Variance is flagged to the owner, one tap to audit |
| Stock would go negative | The write is refused, never negative stock |
| A record is deleted | Archived with who and when. Never erased |
| An owner changes money | One-tap undo that writes the opposite posting |
| The store changes under the merchant | Draft regenerates. It never publishes by itself |
| The merchant publishes | One tap. The only way a store goes live |
| A member leaves | Their access is withdrawn at once, history is kept |
| A workspace is deleted | Records stay. Export first, then remove access |
| A scheduled flow misses its time | It runs late, once, and says so |
| Two flows start on the same event | One wins by idempotency key, the other is dropped |
| The design library is empty | The default design for the industry is used |
| A recipe slot has no source | The section is skipped, the gate lists it |
| A proof is missing | Trust section is not offered |
| Jev returns an unknown option | Treated as no answer. Code decides |
| Costs reach the monthly ceiling | Reads keep working, writes are paused and reported |
