# Canvas

| Part | Holds |
| :--- | :--- |
| A | Product concept: vocabulary, surfaces, cards, access, safety, laws |
| B | Concept screens: setup, daily, inside, grow, manage |
| C | Cards and capabilities: 18 cards, inbox, stages, deep commits, variants |

```
THE IDEA
  A drawer of tools -> a Canvas of cards.
  Card = saved read + one tap.
  Flow = ordered steps.
  Jev decides. Code commits.
```

```
18 tool cards
2 card shapes
5 surfaces
6 laws
0 model calls at runtime
```

---

# PART A - CONCEPT

## A1. Vocabulary

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, cards, site, one database | Aambal Neyvagam, Salem |
| Canvas | Your home surface: only the cards allowed for you and useful now | Cashier sees 4, owner sees 6 |
| Card | Saved read + one tap | Cash drawer: Rs. 4,350 + [ Count Cash ] |
| Flow | Ordered, resumable steps | Evening closing |
| Step | One existing tool call | Count cash drawer |
| Run | One execution of a flow | Closing run 104, step 2 of 4 |
| Record | Typed row in the one records table | item, stock, order |
| Posting | Balanced debit and credit written with a record | sale: debit cash, credit revenue |
| Projection | Read-only report over records | P&L, GST return, forecast |
| Role | What a member does; set by Jev from plain English | Member (Cashier) |
| Reach | Risk of an action; decides if a confirm is needed | money, customer, data, none |
| Inbox | Personal to-act feed; one card per member | 2 waiting, 1 overdue |

## A2. Surfaces

```
+------------------------+        +------------------------+
| [pos]  [order]  [item] |        | Counter Sales          |
| [cash] [store]  [chat] |   ->   | Rs. 18,450  UPI 14,100 |
| [flow] [stock]  [more] |        | 14 bills  [ New Sale ] |
+------------------------+        +------------------------+
a drawer of tool icons            a Canvas of cards
same for everyone                 your job, now, one tap
```

| Surface | Holds |
| :--- | :--- |
| Canvas | Home stack: only cards allowed for you and useful now |
| Flows | Active runs and available flows |
| Site | Storefront preview, edit and publish |
| You | Profile, settings, workspaces |
| Inbox | Personal to-act card and feed, mandatory for every member |

## A3. Card

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
Anatomy and rules: see 3.6
```

## A4. How work runs

```
CARD  = saved read + one tap
FLOW  = ordered steps
STEP  = one existing tool call
TAP   -> CHECK -> ONE RECORD -> EVENT -> EVERY CARD
```

| Word | Meaning |
| :--- | :--- |
| Check | grants, version, idempotency |
| Confirm | one tap for money or customer |
| Archive | delete means hide, never erase |
| Undo | one tap reverses the same record |
| Deep step | one screen, one balanced commit |

```
MONEY OR CUSTOMER -> one confirm.
NO MODEL ON RENDER OR RUN.
FULL GRAMMAR: 3 GATES + 4 MODIFIERS, SEE flows.md.
```

## A5. Access

```
workspace enabled
  AND Jev grants for this member
  AND now
  = visible cards
```

```
JEV READS  "cashier, packs orders, no price edits"
ALLOW      Counter Sales, Cash Drawer, Order Fulfilment, Inbox
HIDE       Products and Prices, Store Studio, Team, Revenue
```

Roles are never picked from a dropdown.

| Card or action | Owner | Admin | Member (Cashier) | Guest |
| :--- | :---: | :---: | :---: | :---: |
| Counter Sales (pos) | Full | Full | Execute only | Denied |
| Cash Drawer (register) | Full | Full | Shift only | Denied |
| Revenue Summary | Full | Full | Hidden | Denied |
| Order Packing (order) | Full | Full | Full | Denied |
| Pricing and Catalog (item) | Full | Full | View only | Denied |
| Storefront Studio (site) | Full | Full | View only | Public view |
| Team and Grants (members) | Full | Full | Hidden | Denied |

```
Full = see and act. Execute only = act, no settings.
View only = see only. Hidden = not shown. Denied = no access.
```

A person may belong to several workspaces; each is isolated. No cross-workspace aggregation yet.

## A6. Jev promise

```
JEV reads plain words and picks cards and grants.
CODE enforces the same check on every tap.
JEV returns typed choices, never prose.
LLM writes language, never decisions.
CODE owns numbers, stock, money and commit.
```

| Layer | Owns |
| :--- | :--- |
| Jev | choices |
| LLM | language |
| Code | truth |

Cache by state hash plus model id: same state gives the same answer with 0 calls.

## A7. One tap, one truth

```
TAP
 |
 v
CHECK  token, grants, version, idempotency
 |
 v
ONE RECORD ROW   + postings
 |
 v
EVENT --> INBOX (role-filtered) --> EVERY CANVAS SYNCS
```

| Situation | Behavior |
| :--- | :--- |
| Reads | pending orders, cash on hand, active runs |
| Offline | "Saved on phone, will sync when online" |
| Delete | archive, never erase |
| Undo | one tap, same record |

## A8. Six laws

| Law | Rule |
| :--- | :--- |
| 1 Balanced books | Every event writes matching debits and credits |
| 2 Stock never negative | Available = on hand - reserved, never below zero |
| 3 Nothing is erased | Every change appends who, when and what changed |
| 4 No table bloat | A new trade is a new record type, never a new table |
| 5 Owner safety floor | Money or customer messages need one confirm |
| 6 Zero fear | Every owner tap is reversible with one-tap undo |

---

# PART B - CONCEPT SCREENS

`+---+` = divider. `[x]` done, `[>]` current, `[ ]` pending.

| Group | Screens |
| :--- | :--- |
| Set up | 3.1 Create workspace, 3.2 Review cards, 3.3 Add member |
| Daily work | 3.4 Owner Canvas, 3.5 Staff Canvas |
| Inside a card | 3.6 Card anatomy, 3.7 Product, 3.8 Flow, 3.9 Site, 3.10 Channel and human, 3.11 Checkout |
| Grow the Canvas | 3.12 Add card |
| Manage | C3.1 Business Manager, C3.2 Stage detail, C3.3 Financial Health |

## 3.1 Create a workspace

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

## 3.2 Review the cards Jev selected

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| < Back                               Ready |
+--------------------------------------------+
| Your Shop Canvas                           |
| AAMBAL NEYVAGAM - Salem                    |
| Handloom and Apparel (95% match)           |
+--------------------------------------------+
| JEV SELECTED 5 CARDS                       |
| [x] Counter Sales                          |
| [x] Orders and Shipping                    |
| [x] Products and Stock                     |
| [x] Online Store                           |
| [x] Evening Closing                        |
| Tap a card to start. More later            |
| via + Add Card.                            |
| [ Confirm and Open Canvas ]                |
+--------------------------------------------+
```

## 3.3 Add a member and their cards

```
+--------------------------------------------+
| 2:07                               98% [=] |
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
| [x] Order Fulfilment                       |
| [ ] Products and Prices                    |
| [ ] Online Store Studio                    |
| Jev assigned: Member (Cashier)             |
| [ Save and Send Invitation ]               |
+--------------------------------------------+
```

## 3.4 Owner Canvas

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| Aambal Neyvagam                      Owner |
+--------------------------------------------+
| ! Cash drawer out by Rs. 350               |
|   Shift #14 - tap to audit               > |
+--------------------------------------------+
| NEXT  Dispatch order #42        due in 15m |
|                               [ Complete ] |
+--------------------------------------------+
| COUNTER SALES                     SHIFT 14 |
| Today Rs. 18,450   UPI Rs. 14,100          |
| 14 bills, drawer cash Rs. 4,350            |
| [ New Counter Sale ]                       |
+--------------------------------------------+
| ORDERS AND FULFILMENT                      |
| Pending 3     Dispatched today 11          |
| Next: garment for Senthamizh - Courier     |
| [ Open Queue ]                             |
+--------------------------------------------+
| ONLINE STORE                          LIVE |
| aambal.tar.site                             |
| Visits today 142   WhatsApp enquiries 8    |
| [ View Store ]                             |
+--------------------------------------------+
| SHOP CLOSING ROUTINE              STEP 2/4 |
| [x] Save invoices                          |
| [>] Count cash - Kanimozhi                 |
| [ ] Send summary on Telegram               |
| [ ] Lock register and close shift          |
| [=====>          ] 50%  [ Resume ]         |
+--------------------------------------------+
| [ + Add a Card ]                           |
| Message TAR...                         (+) |
|  (+)    [Canvas]    Flows    Site    You   |
+--------------------------------------------+
```

## 3.5 Staff Canvas

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| Aambal Neyvagam                  Kanimozhi |
| Cashier - Shift #14                        |
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
| 4:00 PM - not started                      |
| [ Start Handover ]                         |
+--------------------------------------------+
| Ask TAR a question...                  (+) |
|  (+)    [Canvas]    Flows    Site    You   |
+--------------------------------------------+
```

## 3.6 Card anatomy

```
+--------------------------------------------+
| Canvas                        Card anatomy |
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

## 3.7 Product detail

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

## 3.8 Flow detail

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

## 3.9 Site detail

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

## 3.10 Channel and human detail

Same card sheet, different rows.

| Detail | Shows | Actions |
| :--- | :--- | :--- |
| Channel | tasks for you, team feed | Open chat, mark done |
| Human | today's manual tasks, assigned by | Add photo, mark complete |

## 3.11 Checkout sheet

```
+--------------------------------------------+
|         (canvas dimmed behind)             |
|   . . . . . . . . . . . . . . . . . . . .  |
+--------------------------------------------+
| Point of Sale Checkout               Close |
| AAMBAL NEYVAGAM - Shift #14                |
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

## 3.12 Add a card

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

---

# PART C - CARDS AND CAPABILITIES

## C1. The 18 tool cards

| Tool | Card | Shape | Reach | Glance | One tap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| pos | Counter Sales | action | money | cart total, bills today | New Counter Sale |
| register | Cash Drawer | action | money | cash on hand, float | Count Cash |
| item | Products and Prices | action | data | active SKUs, drafts | Add Product |
| inventory | Stock and Warehouse | action | data | units on hand, low stock | Adjust Stock |
| order | Orders and Dispatch | action | customer | waiting to pack, shipped | Open Queue |
| invoice | Billing and GST | action | money | receivables, bills issued | Issue Bill |
| payment | Payments and UPI | action | money | UPI today, cash drops | Record Receipt |
| expense | Daily Expenses | action | money | petty cash spent | Log Expense |
| purchase | Supplier POs | action | money | POs placed, inbound | New PO |
| members | Team and Shifts | action | data | on-duty staff | Manage Staff |
| contact | Customer Ledger | action | customer | total contacts | Add Contact |
| human | Manual Tasks | action | none | jobs assigned to you | Mark Complete |
| flow | Shop Checklists | flow | none | active runs, % done | Resume Flow |
| site | Online Storefront | action | customer | visits, enquiries | View Store |
| inbox | Team Feed | action | none | tasks for you, reviews | Open Feed |
| chat | WhatsApp Chat | action | customer | pending chats | Open WhatsApp |
| whatsapp | WhatsApp API | action | customer | bills dispatched | Check Delivery |
| telegram | Shop Alerts | action | none | low stock, closing pings | Send Alert |

Inbox is mandatory for every member.

## C2. What feeds the Inbox

One event becomes one 1-tap card for the right member:
`event -> who -> one tap -> what changes`.

| Event | Goes to | One tap | What changes |
| :--- | :--- | :--- | :--- |
| Cash variance at shift close | Owner | Audit Shift | shift flagged |
| High-value refund or drawer limit | Owner | Approve Refund | invoice refunded |
| Low stock at threshold | Owner | Create PO | purchase created |
| Paid order placed | Packer | Mark Packed | order packed |
| Invoice past due | Owner | Send Reminder | reminder sent |
| Unverified UPI or bank reference | Cashier | Verify Reference | payment cleared |
| Petty cash payout over limit | Owner | Approve Payout | expense approved |
| Shipment delivered | Stock member | Receive Stock | stock increased |
| Physical task due | Assignee | Tap Done | step completed |
| Flow step ready | Assigned member | Open Step | run advances |

## C3. 110 capabilities in 14 stages

Every capability is a CRUD action. A stage is a tag for the Business Manager.

| Stage | Count | Lives in |
| :--- | :--- | :--- |
| Plan | 4 | projections and flows: forecast, S&OP, budgets, MRP |
| Source | 10 | purchase, contact: suppliers, RFQ, PO, GRN, landed cost, AP, returns |
| Stock | 10 | inventory: ledger, locations, counts, transfers, batches, packing |
| Make | 7 | recipe record and flow: BOM, work orders, scheduling, scrap, QC, costing |
| Catalog | 4 | item: items, variants, units, channel price lists |
| Sell | 10 | pos, register, site: POS, register, print, offline, web store, offers |
| Order | 7 | order, invoice: quotes, orders, reservations, GST invoice, credit ledger, returns |
| Money | 16 | postings: ledger, AP/AR, bank rec, expenses, GST, assets, P&L |
| People | 7 | members and flow: staff, roles, shifts, attendance, payroll |
| Serve | 9 | contact: leads, pipeline, tickets, bookings, time billing |
| Move | 5 | order: carriers, routes, POD, fleet, trips |
| Comply | 4 | records: QC, licenses, statutory dates, document vault |
| Comms | 5 | inbox, whatsapp, telegram: tasks, flows, WhatsApp API, alerts |
| Manage | 12 | Business Manager: dashboards, approvals, branches, backups, settings |

C3 is the map. These three screens are the surface.

| Screen | Opens from | Shows |
| :--- | :--- | :--- |
| C3.1 Business Manager | Manage card or gear | 14 stages, live or off, Jev suggestions |
| C3.2 Stage detail | a stage row | one stage's capabilities, Add Card |
| C3.3 Financial Health | the Money row | ledger, P&L, GST |

### C3.1 Business Manager

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

### C3.2 Stage detail

```
+--------------------------------------------+
| 2:07                               98% [=] |
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

### C3.3 Financial Health

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| < Back                    Financial Health |
+--------------------------------------------+
| October 2026                        Aambal |
+--------------------------------------------+
| Revenue                       Rs. 342,800 |
| COGS                          Rs. 188,400 |
| Gross profit                  Rs. 154,400 |
| Expenses                       Rs. 38,200 |
| Net profit                    Rs. 116,200 |
+--------------------------------------------+
| GST collected                   Rs. 17,140 |
| GST input                        Rs. 9,420 |
| GST due                          Rs. 7,720 |
+--------------------------------------------+
| [ View Ledger ]   [ Export GST ]           |
+--------------------------------------------+
```

## C4. Catalog variants

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

---

Full engine grammar, planner and 40 domain examples: see `flows.md`.
