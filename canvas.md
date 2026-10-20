# Canvas

```
+------------------------+        +------------------------+
| [pos]  [order]  [item] |        | Counter Sales          |
| [cash] [store]  [chat] |   ->   | Rs. 18,450  UPI 14,100 |
| [flow] [stock]  [more] |        | 14 bills  [ New Sale ] |
+------------------------+        +------------------------+
a drawer of tool icons            a Canvas of Cards
same for everyone                 your job, now, one tap
```

| Section | Holds |
| :--- | :--- |
| 1 Vocabulary | every word, defined once |
| 2 How Canvas Works | pipeline, access, tap to commit |
| 3 Concept Screens | 12 phone mocks, grouped by job |
| 4 The 18 Tool Cards | what each card shows and does |
| 5 110 Capabilities | 14 stages, deep screens |
| 6 Rules | flows, six laws, catalog variants |

============================================================

## 1. Vocabulary

Five primitives: Tool Card, Flow, Record, Posting, Projection.

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, enabled cards, site, one database | Aambal Neyvagam, Salem |
| Canvas | Your home surface: only the cards allowed for you and useful now | Cashier sees 4, owner sees 6 |
| Card | One panel for one Tool, Flow, Site, Channel or Human task | Cash drawer: Rs. 4,350 + [ Count Cash ] |
| Tool | Smallest business unit; 18 in total | pos, register, order |
| Flow | Ordered, resumable checklist of steps | Evening closing |
| Run | One active execution of a Flow | Closing run #104, step 2 of 4 |
| Step | One action inside a Run; commits alone | Count cash drawer |
| Record | Typed row in the one records table | item, stock, order |
| Posting | Balanced debit and credit row written with a Record | sale: debit cash, credit revenue |
| Projection | Read-only report computed over Records | P&L, GST return, forecast |
| Role | What a member does in this Workspace; set by Jev from plain English | Member (Cashier) |
| Reach | Risk of an action; decides whether a confirm is needed | money, customer, data, none |
| Gate | Runtime check before a tap commits | token, grants, version, idempotency |
| Inbox | Personal to-act feed; one card per member, role-filtered | 2 waiting, 1 overdue |

### Card kinds

| Kind | Opens | Inside |
| :--- | :--- | :--- |
| tool | list, search, detail sheet | scan, adjust, history |
| flow | checklist run | per-step action with progress |
| site | store preview and edit | edit products, view store |
| channel | feed or chat list | reply, check delivery, send alert |
| human | task list | photo or note proof, mark done |

============================================================

## 2. How Canvas Works

### Pipeline

```
BRIEF -> SELECT -> INVITE -> GRANT -> RANK -> PROJECT -> ONE TAP

CREATION                          RUNTIME
Jev decides cards and grants  ->  Gate enforces the same
                                  grants on every tap
```

| Stage | Reads | Decides |
| :--- | :--- | :--- |
| Brief | owner's plain words | workspace, trade, enabled tools |
| Select | owner brief | 4-5 starting cards from the 18; the rest arrive via + Add Card |
| Invite | phone or email | the member joins the Workspace |
| Grant | the member's plain-English job | which cards that member may see |
| Rank | time, routine, rush, manual hold | the order of cards on that member's Canvas |
| Project | steps 1-5 | the cards on screen |

### Access

```
workspace enabled
  AND Jev grants for this member
  AND now
  = visible cards

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

Full = see and act. Execute only = act, no settings. View only = see only.
Hidden = not shown. Denied = no access. Public view = anyone can open.

A person may belong to several Workspaces; each is isolated. No cross-workspace
aggregation yet.

### Order, not settings

```
WHEN       CANVAS
morning    counter on top
rush       counter expands, rest collapse
evening    closing flow rises
nothing    order card says "All packed" and drops
manual     hold a card to pin it
```

### One tap, one truth

Every capability takes this one path and commits one Record.

```
TAP
 |
 v
GATE   token, grants, version, idempotency
 |
 v
ONE RECORD ROW   + postings
 |
 v
EVENT --> INBOX (role-filtered) --> EVERY CANVAS SYNCS

READS      pending orders, cash on hand, active runs
OFFLINE    "Saved on phone, will sync when online"
```

============================================================

## 3. Concept Screens

`+---+` = divider. `[x]` done, `[>]` current, `[ ]` pending.

| Job | Screens |
| :--- | :--- |
| Set up | 3.1 Create workspace, 3.2 Review cards |
| Add people | 3.3 Add member |
| Daily work | 3.4 Owner Canvas, 3.5 Staff Canvas |
| Inside a card | 3.6 Card anatomy, 3.7 Flow, 3.8 Site, 3.9 Checkout |
| Grow the Canvas | 3.10 Add card |
| Manage | 3.11 Business Manager, 3.12 Financial Health |

### 3.1 Create a workspace

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| New Workspace                       Cancel |
+--------------------------------------------+
|                                            |
| Name your workspace                        |
| +----------------------------------------+ |
| | Aambal Neyvagam                        | |
| +----------------------------------------+ |
|                                            |
| What do you make and sell?                 |
| +----------------------------------------+ |
| | Weave silk and cotton sarees, UPI      | |
| | and cash counter, ship across TN,      | |
| | need an online store.                  | |
| +----------------------------------------+ |
|                                            |
| Jev will place the right cards             |
| on your Canvas.                            |
|                                            |
| [ Generate Workspace and Canvas ]          |
|                                            |
+--------------------------------------------+
```

### 3.2 Review the cards Jev selected

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
|                                            |
| [x] Counter Sales                          |
|     fast billing, UPI and cash             |
|                                            |
| [x] Orders and Shipping                    |
|     pack sarees, print slips               |
|                                            |
| [x] Products and Stock                     |
|     prices, photos, low stock              |
|                                            |
| [x] Online Store                           |
|     aambal.tar.site (live)                 |
|                                            |
| [x] Evening Closing                        |
|     count cash, lock, alert                |
|                                            |
| Tap a card to start. More later            |
| via + Add Card.                            |
|                                            |
| [ Confirm and Open Canvas ]                |
|                                            |
+--------------------------------------------+
```

### 3.3 Add a member and their cards

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
| +----------------------------------------+ |
| | kanimozhi@aambal.in                    | |
| +----------------------------------------+ |
|                                            |
| WHAT WILL THIS PERSON DO?                  |
| +----------------------------------------+ |
| | Counter cashier. Handles sales,        | |
| | counts the drawer, packs orders.       | |
| | Does not edit prices.                  | |
| +----------------------------------------+ |
|                                            |
| CARDS KANIMOZHI CAN SEE                    |
|                                            |
| [x] Counter Sales                          |
| [x] Cash Drawer                            |
| [x] Order Fulfilment                       |
| [ ] Products and Prices                    |
| [ ] Online Store Studio                    |
|                                            |
| Jev assigned: Member (Cashier)             |
|                                            |
| [ Save and Send Invitation ]               |
|                                            |
+--------------------------------------------+
```

### 3.4 Owner Canvas

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
|                                            |
| [ New Counter Sale ]                       |
+--------------------------------------------+
| ORDERS AND FULFILMENT                      |
| Pending 3     Dispatched today 11          |
| Next: saree for Senthamizh - Speed Post    |
|                                            |
| [ Open Queue ]                             |
+--------------------------------------------+
| ONLINE STORE                          LIVE |
| aambal.tar.site                            |
| Visits today 142   WhatsApp enquiries 8    |
|                                            |
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
+--------------------------------------------+
| Message TAR...                         (+) |
+--------------------------------------------+
|  (+)    [Canvas]    Flows    Site    You   |
+--------------------------------------------+
```

### 3.5 Staff Canvas

Same Workspace, fewer cards: revenue totals, price editing and store studio are hidden.

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
|                                            |
| [ Quick Sale ]                             |
+--------------------------------------------+
| ORDER PACKING QUEUE                        |
| To pack 2     Packed today 7               |
|                                            |
| [ Start Packing Next ]                     |
+--------------------------------------------+
| INBOX - TASKS FOR YOU                      |
| 2 waiting, 1 overdue                       |
|                                            |
| [ Open Feed ]                              |
+--------------------------------------------+
| SHIFT HANDOVER FLOW                        |
| 4:00 PM - not started                      |
|                                            |
| [ Start Handover ]                         |
+--------------------------------------------+
| Ask TAR a question...                  (+) |
+--------------------------------------------+
|  (+)    [Canvas]    Flows    Site    You   |
+--------------------------------------------+
```

### 3.6 Card anatomy

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| Canvas                        Card anatomy |
+--------------------------------------------+
| +----------------------------------------+ |
| | [icon] Counter Sales           [SHIFT] | |
| |                                        | |
| | Today Rs. 18,450  UPI Rs. 14,100       | |
| | 14 bills, drawer cash Rs. 4,350        | |
| |                                        | |
| | [ New Counter Sale ]                   | |
| +----------------------------------------+ |
|                                            |
| Tap title     -> opens detail              |
| Tap button    -> commits once              |
| Other actions -> live in detail            |
|                                            |
+--------------------------------------------+
```

### 3.7 Flow detail

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
|        8:45 PM - auto                      |
|                                            |
| [>] 2  Count cash drawer                   |
|        needs you now                       |
|                                            |
| [ ] 3  Send closing summary                |
|        Telegram - after step 2             |
|                                            |
| [ ] 4  Lock register                       |
|        auto                                |
+--------------------------------------------+
| [ Perform Step 2 ]                         |
|                                            |
+--------------------------------------------+
```

### 3.8 Site detail

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
|                                            |
+--------------------------------------------+
```

### 3.9 Checkout sheet

```
+--------------------------------------------+
|                                            |
|         (canvas dimmed behind)             |
|   . . . . . . . . . . . . . . . . . . . .  |
+--------------------------------------------+
| Point of Sale Checkout               Close |
| AAMBAL NEYVAGAM - Shift #14                |
+--------------------------------------------+
| CART (2)                                   |
| Pattu Selai                      Rs. 4,500 |
| Veshti                             Rs. 850 |
|                                            |
| Total                            Rs. 5,350 |
+--------------------------------------------+
| PAYMENT                                    |
| (o) UPI QR    ( ) Cash    ( ) Card         |
|                                            |
| WhatsApp bill to                           |
| +91 98401 23456                            |
+--------------------------------------------+
| Writes order, invoice, payment and         |
| stock in one commit.                       |
|                                            |
| Moves money: one confirm.                  |
|                                            |
| [ Complete Sale - Rs. 5,350 ]              |
|                                            |
+--------------------------------------------+
```

### 3.10 Add a card

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| < Back                            Add Card |
+--------------------------------------------+
| TOOL CARDS - role: Owner                   |
|                                            |
| [x] Counter Sales                          |
| [x] Cash Drawer                            |
| [x] Orders and Shipping                    |
| [x] Online Store                           |
| [ ] Stock and Low Inventory   [ + ]        |
| [ ] Supplier POs              [ + ]        |
| [ ] Daily Expenses            [ + ]        |
+--------------------------------------------+
| FLOW CARDS                                 |
|                                            |
| [x] Evening Closing                        |
| [ ] Morning Opening           [ + ]        |
| [ ] Stock Audit               [ + ]        |
+--------------------------------------------+
| [ Save Canvas Layout ]                     |
|                                            |
+--------------------------------------------+
```

### 3.11 Business Manager

Live stages, Jev suggestions, and every deep action.

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| < Back                    Business Manager |
+--------------------------------------------+
| Aambal Neyvagam                            |
| 14 stages, 9 live, Jev suggests 2          |
+--------------------------------------------+
| LIVE                                       |
| [x] SELL     Counter, register, store   >  |
| [x] STOCK    Godown stock, batches      >  |
| [x] SOURCE   POs, GRN, supplier khata   >  |
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
|                                            |
| [ Download Backup ] [ Export GST ]         |
|                                            |
+--------------------------------------------+
```

### 3.12 Financial Health

Opened from the Money stage. Built only from Postings.

```
+--------------------------------------------+
| 2:07                               98% [=] |
+--------------------------------------------+
| < Back                    Financial Health |
+--------------------------------------------+
| October 2026                        Aambal |
+--------------------------------------------+
| Revenue                       Rs. 3,42,800 |
| COGS                          Rs. 1,88,400 |
+--------------------------------------------+
| Gross profit                  Rs. 1,54,400 |
| Expenses                        Rs. 38,200 |
| Net profit                    Rs. 1,16,200 |
+--------------------------------------------+
| GST collected                   Rs. 17,140 |
| GST input                        Rs. 9,420 |
| GST due                          Rs. 7,720 |
+--------------------------------------------+
| [ View Ledger ]   [ Export GST ]           |
|                                            |
+--------------------------------------------+
```

============================================================

## 4. The 18 Tool Cards

| Tool | Card | Kind | Reach | Glance | One tap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| pos | Counter Sales | tool | money | cart total, bills today | [ New Counter Sale ] |
| register | Cash Drawer | tool | money | cash on hand, float | [ Count Cash ] |
| item | Products and Prices | tool | data | active SKUs, drafts | [ Add Product ] |
| inventory | Stock and Warehouse | tool | data | units on hand, low stock | [ Adjust Stock ] |
| order | Orders and Dispatch | tool | customer | waiting to pack, shipped | [ Open Queue ] |
| invoice | Billing and GST | tool | money | receivables, bills issued | [ Issue Bill ] |
| payment | Payments and UPI | tool | money | UPI today, cash drops | [ Record Receipt ] |
| expense | Daily Expenses | tool | money | petty cash spent | [ Log Expense ] |
| purchase | Supplier POs | tool | money | POs placed, inbound | [ New PO ] |
| members | Team and Shifts | tool | data | on-duty staff | [ Manage Staff ] |
| contact | Customer Ledger | tool | customer | total contacts | [ Add Contact ] |
| human | Manual Tasks | human | none | jobs assigned to you | [ Mark Complete ] |
| flow | Shop Checklists | flow | none | active runs, % done | [ Resume Flow ] |
| site | Online Storefront | site | customer | visits, enquiries | [ View Store ] |
| inbox | Team Feed | channel | none | tasks for you, reviews | [ Open Feed ] |
| chat | WhatsApp Chat | tool | customer | pending chats | [ Open WhatsApp ] |
| whatsapp | WhatsApp API | channel | customer | bills dispatched | [ Check Delivery ] |
| telegram | Shop Alerts | channel | none | low stock, closing pings | [ Send Alert ] |

**Inbox is mandatory** for every member.

### What feeds the Inbox

One event becomes one 1-tap card for the right member:
`event -> who -> one tap -> what changes`. Only the recipient's role sees it.
It is born on the event, cleared on tap, across every device.

| Event | Goes to | One tap | What changes |
| :--- | :--- | :--- | :--- |
| Cash variance at shift close | Owner | [ Audit Shift ] | shift flagged |
| High-value refund or drawer limit | Owner | [ Approve Refund ] | invoice refunded |
| Low stock at threshold | Owner | [ Create PO ] | purchase created |
| Paid order placed | Packer | [ Mark Packed ] | order packed |
| Invoice past due | Owner | [ Send Reminder ] | reminder sent |
| Unverified UPI or bank reference | Cashier | [ Verify Reference ] | payment cleared |
| Petty cash payout over limit | Owner | [ Approve Payout ] | expense approved |
| Shipment delivered | Stock member | [ Receive Stock ] | stock increased |
| Physical task due | Assignee | [ Tap Done ] | step completed |
| Flow step ready | Assigned member | [ Open Step ] | run advances |

============================================================

## 5. 110 Capabilities in 14 Stages

| Stage | Count | Capabilities live in |
| :--- | :--- | :--- |
| Plan | 4 | projections and flows: forecast, S&OP, budgets, MRP |
| Source | 10 | purchase, contact: suppliers, RFQ, PO, GRN, landed cost, AP, returns |
| Stock | 10 | inventory: ledger, locations, counts, transfers, batches, packing |
| Make | 7 | recipe record and flow: BOM, work orders, scheduling, scrap, QC, costing |
| Catalog | 4 | item: items, variants, units, channel price lists |
| Sell | 10 | pos, register, site: POS, register, print, offline, web store, offers |
| Order | 7 | order, invoice: quotes, orders, reservations, GST invoice, khata, returns |
| Money | 16 | postings: ledger, AP/AR, bank rec, expenses, GST, assets, P&L |
| People | 7 | members and flow: staff, roles, shifts, attendance, payroll |
| Serve | 9 | contact: leads, pipeline, tickets, bookings, time billing |
| Move | 5 | order: carriers, routes, POD, fleet, trips |
| Comply | 4 | records: QC, licenses, statutory dates, document vault |
| Comms | 5 | inbox, whatsapp, telegram: tasks, flows, WhatsApp API, alerts |
| Manage | 12 | Business Manager: dashboards, approvals, branches, backups, settings |

### Deep screens

Each opens from its card and commits once.

| Screen | Opens from | One commit does |
| :--- | :--- | :--- |
| Goods receipt | purchase, receive | stock up, supplier paid, AP and landed cost posted |
| Weaving run | flow, production | yarn and zari out, scrap logged, finished goods in at unit cost |
| Shift close | register, close | cash counted, variance shown, journal posted |
| Dispatch | order, fulfil | packed, slip printed, tracking sent, reservation cleared |
| Payroll | members, flow | attendance x rate - advances paid by UPI, payslip sent, salary posted |

============================================================

## 6. Rules

### Flows

| Rule | Meaning |
| :--- | :--- |
| Run is a card | An active Run shows progress and its current step on the Canvas |
| Per-step commit | Each Step commits alone and is idempotent; a retry never doubles it |
| Auto vs interactive | Auto steps write in the background; steps that touch money or customers pause and show [ Perform Step ] |
| Resumable anywhere | Kanimozhi counts cash on a tablet; Kayalvizhi sees step 2 turn green instantly |

### Six laws

| Law | Rule |
| :--- | :--- |
| 1 Balanced books | Every event writes matching debits and credits |
| 2 Stock never negative | Available = on hand - reserved, never below zero |
| 3 Nothing is erased | Every change appends who, when and what changed |
| 4 No table bloat | A new trade is a new record type, never a new table |
| 5 Owner safety floor | Money or customer messages need one confirm |
| 6 Zero fear | Every owner tap is reversible with one-tap undo, in plain words |

### Catalog variants

One item becomes sellable variants through one Jev choice question: which
dimension does the description name? Code computes rows, barcodes, stock and
prices. Jev never produces a number.

| Key | Means | Examples |
| :--- | :--- | :--- |
| size | clothing or shoe size | S/M/L, 38/40, King |
| length | textile length or cable | 4-muzham, 8-muzham, 6.2m |
| weight | mass | 250g, 25kg bag, 1 pavan |
| volume | liquid capacity | 500ml, 1L, 5L can |
| color | shade or pattern | red, temple border |
| flavour | taste or scent | chocolate, sandal |
| material | grade | pure silk, silver 92.5 |
| portion | serving | quarter, half, flask |
| prep | custom option | eggless, lining (+Rs. 150) |
| time | duration | 1 hour, 1 month plan |
| tier | turnaround level | standard 3d, express 1d |
| pack | bundle count | single, pack of 6, box of 50 |

"Red and blue, S and M" -> Jev picks color and size -> code computes 2 x 2 = 4
variant rows at the base price, with SKUs, variant records and per-variant stock.
POS scan and the web store bind to the same rows.
