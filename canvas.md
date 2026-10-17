# Canvas — The Living Operational Surface

> **Idea in One Line:**  
> Instead of a drawer of tool icons, the workspace shows a **Canvas of living Cards**. Each Card is a glanceable lens into a Tool or Flow with live numbers and a 1-tap action — shown only if your role needs it.

---

## 1. How Canvas Works — Human Rules

No math on screen. These are the rules the system follows:

*   **Canvas = What you should see right now.** Workspace has some cards + Your job needs some of them + Right now only the relevant ones are on top.
*   **Card = Quick look + One tap.** Title + 2 live numbers + short context + 1 big primary button.
*   **Flow Card = Checklist with progress.** Current step + who does it + % done + Continue button. Resumes from any device.
*   **Access = Can you see it?** Card is visible only if Workspace enabled it AND Jev allowed it for your job description.
*   **Safety = Money or Customer needs confirm.** Any action that moves money or messages a customer pauses for confirmation.
*   **Truth = One write, everyone sees.** Tap → Gateway checks → Single `records` row in Workspace Turso DB → Event → Your Canvas and teammates' Canvas sync.

> **Jev TypeSafe:** Jev decides cards and grants at creation time (type-safe, compile-level). Gateway enforces the exact same check at runtime. Zero mismatch.

### What Each Word Means

| Concept | Plain Meaning | Example |
| :--- | :--- | :--- |
| **Workspace** | Business boundary (1 Turso DB, members, enabled cards, site) | `w_aambal` — Aambal Neyvagam, Salem |
| **Canvas** | Your home surface — only cards allowed for you | Kanimozhi sees 3 cards, Owner sees 6 |
| **Card** | One panel for one Tool/Flow | Cash Drawer: `₹4,350 in drawer` + `[Count Cash]` |
| **Tool** | Smallest business unit | `pos`, `register`, `order`, `inventory` (18 total) |
| **Flow** | Ordered steps of tools | Evening Closing: Count → Report → Lock |
| **Run** | One active execution of a flow | Closing Run #104, Step 2 of 4 |
| **Role** | What you do in this workspace | Decided by Jev from plain English job description |
| **Reach** | How risky the action is | `money` / `customer` / `data` / `none` → decides if confirm needed |
| **Gate** | Check before running | Gateway verifies token + grants + version + idempotency |
| **Inbox Card** | Your personal to-act feed | Always on your Canvas — tasks assigned to you |

---

## 2. How a Workspace Becomes a Canvas

```text
OWNER BRIEF ──► JEV SELECTS CARDS ──► INVITE MEMBER ──► JEV GRANTS CARDS ──► ROLE CANVAS ──► 1-TAP ACTION
```

Jev does 3 things to keep it zero-complex:
1. **Select** — picks 4-5 starting cards from 18 based on owner brief. Rest via `+ Add Card`.
2. **Grant** — reads member's job description ("counter cashier, packs orders, no price edits") and allows only matching cards.
3. **Rank** — orders cards by time and job (counter on top during shop hours, closing flow rises in evening).

Each card tap opens a **Detail Screen** — Canvas stays glance-only, full work happens inside.

| Card Kind | Detail Screen | Inside Actions |
| :--- | :--- | :--- |
| Tool (`pos`, `item`, `inventory`, etc.) | List + Search + Detail + Sheet | Scan, Adjust, History, History |
| Flow (`flow`) | Checklist Run | Per-step `[Do Step]` with progress |
| Site (`site`) | Store Preview + Edit | `[Edit Products]` `[View Store]` |
| Channel (`inbox`, `chat`, `whatsapp`, `telegram`) | Feed / Chat List | Reply, Check Delivery, Send Alert |
| Human (`human`) | Task List | Photo/Note proof → `[Mark Done]` |

Canvas shows **1 primary action** per card. Remaining 2-3 actions live inside the Detail Screen.

**Time-Aware Canvas (auto, no settings):** Morning → Counter on top. Rush → Counter expands, others collapse. Evening → Closing Flow rises. No orders → Order card shows `All packed ✅` and moves down. Manual pin via Hold.

---

## 3. Concept Screens

### Screen 1: Workspace Creation & Business Brief

```text
+-------------------------------------------------------------+
| TAR · New Workspace                                [Cancel] |
+-------------------------------------------------------------+
| Name your workspace                                         |
| [ Aambal Neyvagam                                         ] |
| Describe what you do and sell:                              |
| +---------------------------------------------------------+ |
| | Handloom atelier in Salem. Weave silk/cotton sarees,    | |
| | run retail counter with UPI/cash, ship across TN, need  | |
| | an online shop.                                         | |
| +---------------------------------------------------------+ |
| 💡 Jev will place the right cards on your Canvas.           |
| [ Generate Workspace & Canvas ]                             |
+-------------------------------------------------------------+
```

### Screen 2: Review Your Canvas Cards

```text
+-------------------------------------------------------------+
| ‹ Back                  Your Shop Canvas            [Ready] |
+-------------------------------------------------------------+
| AAMBAL NEYVAGAM · Salem                                     |
| Trade: Handloom & Apparel Atelier (95% match)               |
| CARDS ON YOUR CANVAS (Jev selected 5):                      |
| +---------------------------------------------------------+ |
| | [x] 🏪 Counter Sales       Fast billing, UPI & cash      | |
| | [x] 📦 Orders & Shipping   Pack sarees, print slips      | |
| | [x] 🏷️ Products & Stock    Prices, photos, low-stock    | |
| | [x] 🌐 Online Store        aambal.tar.site (Live)        | |
| | [x] 🔄 Evening Closing     Count cash, lock, alert       | |
| +---------------------------------------------------------+ |
| 💡 Tap any card to start. Add more anytime with + Add Card. |
| [ Confirm & Open Canvas ]                                   |
+-------------------------------------------------------------+
```

### Screen 3: Add Member & Card Access

```text
+-------------------------------------------------------------+
| ‹ Back             Add Team Member                  [Done]  |
+-------------------------------------------------------------+
| Workspace: Aambal Neyvagam                                  |
| Member phone or email: [ kanimozhi@aambal.in ]              |
| What will this person do?                                   |
| +---------------------------------------------------------+ |
| | Counter cashier. Handles sales, counts drawer, packs    | |
| | orders. Does not edit prices.                           | |
| +---------------------------------------------------------+ |
| CARDS KANIMOZHI CAN SEE & USE (Jev evaluated)               |
| +---------------------------------------------------------+ |
| | [x] 🏪 Counter Sales       [x] 💳 Cash Drawer             | |
| | [x] 📦 Order Fulfillment   [ ] 🏷️ Products & Prices      | |
| | [ ] 🌐 Online Store Studio                               | |
| +---------------------------------------------------------+ |
| Assigned Role: Member (Cashier)                             |
| [ Save & Send Invitation ]                                  |
+-------------------------------------------------------------+
```

### Screen 4: Master Canvas — Owner View

```text
+-------------------------------------------------------------+
| 2:07 🛜                                                🔋 98%|
|  (+)     ( Canvas )         Flows         Site        (👤)  |
+-------------------------------------------------------------+
| ⚠️ Shift #14 Cash Drawer has ₹350 variance. Tap to review. ›|
| ⚡ JEV NEXT ACTION: [ Complete ] Dispatch Order #42 (Due 15m)|
+-------------------------------------------------------------+
| 🏪 Counter Sales                                            |
|   Today's Sales ₹18,450 · Active Shift Cash ₹4,350          |
|   14 bills · Net UPI ₹14,100  [ New Counter Sale ]          |
+-------------------------------------------------------------+
| 📦 Orders & Fulfillment                                     |
|   Pending 3 · Dispatched Today 11                           |
|   Next: Saree for Senthamizh (Speed Post) [ Open Queue ]    |
+-------------------------------------------------------------+
| 🌐 Online Storefront · aambal.tar.site              [LIVE]  |
|   Visits Today 142 · WhatsApp Enquiries 8  [ View Store ↗ ] |
+-------------------------------------------------------------+
| 🔄 Shop Closing Routine                          [STEP 2/4] |
|   Count Cash — Kanimozhi · [======>     ] 50% [ Resume › ]  |
+-------------------------------------------------------------+
|              [ + Create a new panel ]                       |
| [ Message TAR...                                     (+) 🎙 ]|
+-------------------------------------------------------------+
```

### Screen 5: Filtered Canvas — Staff / Cashier View

Same workspace, fewer cards. Revenue totals, price editing, and site studio are hidden.

```text
+-------------------------------------------------------------+
| Aambal Neyvagam · Kanimozhi (Cashier) · Shift #14      (👤) |
| ⚡ YOUR NEXT TASK: Pack parcel for Senthamizh (2 items)     |
+-------------------------------------------------------------+
| 💳 Counter Register · Shift #14                             |
|   Bills Cleared 9 · Drawer Cash ₹4,350  [ Quick Sale ]      |
+-------------------------------------------------------------+
| 📦 Order Packing Queue                                      |
|   To Pack 2 items · Packed 7  [ Start Packing Next ]        |
+-------------------------------------------------------------+
| 📥 Inbox — Tasks For You                                    |
|   2 waiting · 1 overdue  [ Open Feed ]                      |
+-------------------------------------------------------------+
| 🔄 Shift Handover Flow                                      |
|   4:00 PM · 0 blocking  [ Start Handover › ]                |
+-------------------------------------------------------------+
| [ Ask TAR a question...                              (+) 🎙 ]|
+-------------------------------------------------------------+
```

### Screen 6: Tool Panel Anatomy (Glance → Tap → Detail)

```text
+-------------------------------------------------------------+
| [Icon] Title · Context                              [Badge] |
|   Metric 1              Metric 2                            |
|   Context / Sync time                                       |
|   [ Primary Action ]                                        |
+-------------------------------------------------------------+
  Tap header → Detail Screen (list/search/history)
  Primary action stays on Canvas, secondary actions inside Detail
```

### Screen 7: Flow Checklist Panel Anatomy

```text
+-------------------------------------------------------------+
| 🔄 Evening Shop Closing                          [STEP 2/4] |
|   Current: Count Cash Drawer · Assigned: Kanimozhi          |
|   ✓ Step 1: Save invoices (8:45 PM)                         |
|   ● Step 2: Cash audit & reconciliation                     |
|   ○ Step 3: Send closing summary on Telegram                |
|   ○ Step 4: Lock register & close shift                     |
|   [============>         ] 50%  [ Perform Step 2 ]          |
+-------------------------------------------------------------+
```

### Screen 8: Site Storefront Panel Anatomy

```text
+-------------------------------------------------------------+
| 🌐 Online Storefront · aambal.tar.site               [LIVE] |
|   Catalog 24 published · Weekly Visits 892                  |
|   Design: arte* (Refero) · Edge: Cloudflare R2 + Workers    |
|   [ View Store ↗ ]  [ Edit Products ]                       |
+-------------------------------------------------------------+
```

### Screen 9: Action Execution Sheet

```text
+-------------------------------------------------------------+
| ‹ Close           Point of Sale Checkout                    |
| AAMBAL NEYVAGAM · Shift #14                                 |
| CART (2): Pattu Selai ₹4,500 + Veshti ₹850 = ₹5,350         |
| Payment: [*] UPI QR  [ ] CASH  [ ] CARD                     |
| WhatsApp bill: [ +91 98401 23456 ]                          |
| Writes order + invoice + payment + stock in one commit      |
| [ Complete Sale · ₹5,350 ]                                  |
+-------------------------------------------------------------+
```

### Screen 10: Add Panel to Canvas

```text
+-------------------------------------------------------------+
| ‹ Back               Add Panel to Canvas            [Done]  |
| TOOL PANELS (based on your role: Owner)                     |
| [x] Counter Sales [x] Cash Register [x] Orders [x] Store   |
| [ ] Stock & Low Inventory  [ + Add ]                        |
| [ ] Supplier POs           [ + Add ]                        |
| [ ] Daily Expenses         [ + Add ]                        |
| FLOW PANELS                                                 |
| [x] Evening Closing  [ ] Morning Opening  [ ] Stock Audit   |
| [ Save Canvas Layout ]                                      |
+-------------------------------------------------------------+
```

---

## 4. The 18 Canonical Tools as Canvas Cards

All 18 stay as individual cards (no merges). Every business capability maps to these cards + one `records` table (see Section 5).

| Tool ID | Panel Name | Kind | Reach | Glance Metrics | Primary Action (Canvas) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pos` | Counter Sales | tool | money | Cart total, bills today | `[ New Counter Sale ]` |
| `register` | Cash Drawer | tool | money | Cash on hand, float | `[ Count Cash ]` |
| `item` | Products & Prices | tool | data | Active SKUs, drafts | `[ Add Product ]` |
| `inventory` | Stock & Warehouse | tool | data | Units on hand, low-stock | `[ Adjust Stock ]` |
| `order` | Orders & Dispatch | tool | customer | Waiting to pack, shipped | `[ Open Queue ]` |
| `invoice` | Billing & GST | tool | money | Receivables, bills issued | `[ Issue Bill ]` |
| `payment` | Payments & UPI | tool | money | UPI today, cash drops | `[ Record Receipt ]` |
| `expense` | Daily Expenses | tool | money | Petty cash spent | `[ Log Expense ]` |
| `purchase` | Supplier POs | tool | money | POs placed, inbound | `[ New PO ]` |
| `members` | Team & Shifts | tool | data | On-duty staff | `[ Manage Staff ]` |
| `contact` | Customer Ledger | tool | customer | Total contacts | `[ Add Contact ]` |
| `human` | Manual Tasks | human | none | Jobs assigned to you | `[ Mark Complete ]` |
| `flow` | Shop Checklists | flow | none | Active runs, % done | `[ Resume Flow ]` |
| `site` | Online Storefront | site | customer | Visits, enquiries | `[ View Store ↗ ]` |
| `inbox` | Team Feed | channel | none | Tasks for you, reviews | `[ Open Feed ]` |
| `chat` | WhatsApp Chat | tool | customer | Pending chats | `[ Open WhatsApp ]` |
| `whatsapp` | WhatsApp API | channel | customer | Bills dispatched | `[ Check Delivery ]` |
| `telegram` | Shop Alerts | channel | none | Low-stock, closing pings | `[ Send Alert ]` |

> **Inbox is mandatory** — every member gets an Inbox card filtered to their tasks. It's the to-act lens.

---

## 5. The Whole Business on Cards (14 Stages, 110 Capabilities)

TAR covers every ERP capability with **5 primitives** — no new tables per trade:

| Primitive | Plain Meaning | Example |
| :--- | :--- | :--- |
| **Tool Card** | 1-tap panel with 2 numbers + 1 action | `pos`, `register`, `order` |
| **Flow** | Ordered resumable checklist | Closing, Stocktake, Payroll Run |
| **Record** | Row in one `records` table, typed `data` | `type='item'`, `type='stock'`, `type='recipe'` |
| **Posting** | Auto balanced debit/credit row | Sale: Debit Cash · Credit Revenue |
| **Projection** | Read-only report (SQL / Jev) | P&L, GST JSON, demand forecast |

### All 110 Capabilities → Cards Map

| Stage | Capabilities | Lives in | Key Actions |
| :--- | :--- | :--- | :--- |
| **Plan** (4) | Forecast, S&OP, Budgets, MRP | Projections + Flows | `forecast.generate`, `plan.mrp` |
| **Source** (10) | Suppliers, RFQ, PO, GRN, Landed Cost, AP, Returns | `purchase`, `contact` | `purchase.create`, `.receive`, `.return` |
| **Stock** (10) | Ledger, Locations, Counts, Transfers, Batches, Packing | `inventory` | `stock.adjust`, `stock.transfer` |
| **Make** (7) | BOM, Work Orders, Scheduling, Scrap, QC, Costing | `recipe` record + Flow | `production.start`, `.complete` |
| **Catalog** (4) | Items, Variants, Units, Channel Price Lists | `item` | `catalog.item.save`, `price.set` |
| **Sell** (10) | POS, Register, Print, Offline, Web Store, Offers | `pos`, `register`, `site` | `pos.checkout`, `pos.register.close` |
| **Order** (7) | Quotes, Orders, Reservations, GST Invoice, Khata, Returns | `order`, `invoice` | `order.create`, `.fulfill`, `invoice.issue` |
| **Money** (16) | Ledger, AP/AR, Bank Rec, Expenses, GST, Assets, P&L | Postings (auto) | `payment.record`, `expense.record`, `period.close` |
| **People** (7) | Staff, Roles, Shifts, Attendance, Payroll | `members` + Flow | `attendance.record`, `payroll.run` |
| **Serve** (9) | Leads, Pipeline, Tickets, Bookings, Time Billing | `contact` | `contact.create`, `booking.create`, `task.create` |
| **Move** (5) | Carriers, Routes, POD, Fleet, Trips | `order` | `order.fulfill`, `trip.complete` |
| **Comply** (4) | QC, Licenses, Statutory Dates, Document Vault | Records + R2 | `task.create` + expiry alerts |
| **Comms** (5) | Tasks, Flows, WhatsApp API, Telegram Alerts | `inbox`, `whatsapp`, `telegram` | `task.complete`, `flow.start` |
| **Manage** (12) | Dashboards, Approvals, Branches, Backups, Settings | Business Manager screen | `buildWorkspaceCanvas` |

### The 5 Laws (Every Commit Obeys)

```text
LAW 1  Balanced books      Every event writes matching debits & credits
LAW 2  Stock never negative Available = Onhand - Reserved ≥ 0
LAW 3  Nothing is erased   Every change appends who/when/what changed
LAW 4  No table bloat      New trade = new record type, never a new table
LAW 5  Owner safety floor  Money or customer messages need one confirm
```

### Business Manager Screen (Manage Stage — One Screen for All 14 Stages)

Owner taps the Manage card (or `⚙` in header) to see the full business:
which stages are live, what Jev suggests to enable, and every deep business
action — all in one place. Zero settings hunting.

```text
+-------------------------------------------------------------+
| ‹ Back      Business Manager · Aambal Neyvagam      [Done]  |
+-------------------------------------------------------------+
| 14 STAGES · 9 ACTIVE · Jev suggests 2 more for handloom     |
|                                                             |
| ✓ SELL        Counter · Register · Store          [ Open ]  |
| ✓ STOCK       Godown stock, batches               [ Open ]  |
| ✓ SOURCE      POs, GRN, supplier khata            [ Open ]  |
| ✓ CATALOG     Items, prices per channel           [ Open ]  |
| ✓ ORDER       Orders, GST invoices, dispatch      [ Open ]  |
| ✓ MONEY       Ledger, P&L, GST return   [ View Health › ]   |
| ✓ PEOPLE      Shifts, attendance, payroll         [ Open ]  |
| ✓ COMMS       Inbox, WhatsApp bills, alerts       [ Open ]  |
| ○ MAKE        BOM & weaving runs        [ Jev: Enable ]     |
| ○ PLAN        Demand forecast & MRP     [ Jev: Enable ]     |
| ○ SERVE       Leads & bookings          [ + Enable ]        |
| ○ MOVE        Courier routes & POD      [ + Enable ]        |
| ○ COMPLY      Licenses & expiry alerts  [ + Enable ]        |
|                                                             |
| BACKUPS: Daily 3:00 AM · Last OK today · [ Download Now ]   |
| [ Export GST JSON (Oct) ]      [ View Full Ledger ]         |
+-------------------------------------------------------------+
```

Tapping a live stage opens its cards; tapping a Jev suggestion enables the
stage and adds its cards to the owner Canvas in one tap. Money stage opens
**Financial Health** (auto P&L + GST from postings):

```text
+-------------------------------------------------------------+
| Financial Health · October 2026                     [Export] |
| Revenue ₹3,42,800 · COGS -₹1,88,400 · Gross ₹1,54,400       |
| Expenses -₹38,200 · Net Profit ₹1,16,200                    |
| GST: Collected ₹17,140 - Input ₹9,420 = Payable ₹7,720      |
| [ View Ledger ]                 [ Export GST JSON ]         |
+-------------------------------------------------------------+
```

### Deep Business Screens (Open From Their Cards)

Goods Receipt (`purchase` → receive): enters qty + batch → stock up, supplier
khata updated, AP posted — one commit.

```text
+-------------------------------------------------------------+
| Goods Receipt · PO #1042 · Poonguzhali Weavers     [Confirm] |
| Silk Yarn: Ordered 50 kg · Received [ 50 ] Batch [ OCT-26 ] |
| Bill ₹60,000 + Freight ₹1,500 = Landed ₹61,500              |
| Auto: Stock +50 kg · Pay Poonguzhali ₹60,000 · Cash ₹1,500  |
+-------------------------------------------------------------+
```

Weaving Run (`flow` → production): draws yarn & zari from stock, logs scrap,
QC check, then finished sarees appear in stock with unit cost.

```text
+-------------------------------------------------------------+
| Work Order #48 · Semparuthi Pattu Selai · Loom #3  [Done]   |
| Drawn: Silk 4.5 kg + Zari 0.5 kg · Woven [ 10 ] Scrap 80g   |
| QC: ✓ tension ✓ color (Poonguzhali)                         |
| Auto: Materials out → 10 sarees in stock @ ₹4,150 each      |
+-------------------------------------------------------------+
```

Shift Close (`register` → close): cash counted, variance shown, journal posted.

```text
+-------------------------------------------------------------+
| Shift Close #14 · Kanimozhi                       [Lock]    |
| Float ₹2,000 + Sales ₹14,200 - Petty ₹850 = Expect ₹15,350 |
| Counted [ ₹15,350 ] · Variance ₹0 ✓                         |
+-------------------------------------------------------------+
```

Dispatch (`order` → fulfil): scan to pack, print slip, tracking auto-sent to
customer WhatsApp, stock reservation cleared.

```text
+-------------------------------------------------------------+
| Order #42 · Senthamizh · Paid (UPI)               [Status]  |
| 1x Pattu Selai · Reserved (Shelf-B3)                        |
| Carrier [ India Post ] · Tracking [ SP-88492019-IN ]        |
| [ Scan to Pack ] [ Print Slip ] [ Mark Dispatched ]         |
+-------------------------------------------------------------+
```

Payroll (`members` → run flow): attendance × rate − advances → one-tap UPI
disbursal, PDF payslip to WhatsApp, salary journal posted.

```text
+-------------------------------------------------------------+
| Payroll Run · September 2026                                 |
| Kanimozhi: 26 days · ₹18,000 - adv ₹2,000 = ₹16,000         |
| [ Run Payroll · Payslips to WhatsApp · Journal posted ]     |
+-------------------------------------------------------------+
```

---

## 6. Flows on Canvas

A Flow is tools chained in order: `Flow = Step_n ∘ … ∘ Step_1`

1. **Run is a card:** Active run shows progress bar and current step on Canvas.
2. **Per-step atomic commit:** Each step commits alone with `flow:{runId}:{stepIndex}` idempotency key.
3. **Auto vs Interactive:** `auto` steps (create record/task) run in background. `interactive` steps (money/customer) pause and show `[Perform Step]`.
4. **Resumable anywhere:** Kanimozhi counts cash on tablet → Kayalvizhi sees Step 2 turn green on phone instantly.

---

## 7. Who Sees What — Role & Projection

Plain rule: `Visible Cards = Workspace enabled ∩ Jev grants for this member ∩ Now`

```text
STEP 1: Resolve Context     → Time + Routine + Manual Hold + Rush
STEP 2: Check Workspace     → pos=true, order=true, site=true (from brief)
STEP 3: Check Member Grants → Jev evaluated "cashier, packs orders, no price edits"
           Allowed: [Counter Sales, Cash Drawer, Packing, Inbox]
           Hidden:  [Products & Prices, Store Studio, Team Grants, Revenue Summary]
STEP 4: Project Canvas      → Surfaced: [POS] [Register] [Packing] [Inbox]
                               Time-ranked: Counter on top, Closing rises at 8pm
```

Role is **not picked from a dropdown** — owner writes plain English, Jev assigns label (`Member — Cashier`) and grants. Gateway enforces same grants on every tap.

| Card / Action | Owner | Admin | Member (Cashier) | Guest |
| :--- | :---: | :---: | :---: | :---: |
| Counter Sales (`pos`) | Full | Full | Execute only | Denied |
| Cash Drawer (`register`) | Full | Full | Shift only | Denied |
| Revenue Summary | Full | Full | Hidden | Denied |
| Order Packing (`order`) | Full | Full | Full | Denied |
| Pricing & Catalog (`item`) | Full | Full | View only | Denied |
| Storefront Studio (`site`) | Full | Full | View only | Public view |
| Team & Grants (`members`) | Full | Full | Hidden | Denied |

---

## 8. One Table Truth — Data Architecture

All 110 capabilities use **one table**: `workspace.records (type, data, version)` + Postings + Projections. No new tables per vertical.

```text
 MEMBER TAPS CARD ("Complete Sale")
        │
        ▼
 ACTION GATEWAY — checks token, grants, version, idempotency
        │
        ▼
 TURSO WORKSPACE DB — writes 1 canonical `records` row
        │  ──► CLOUDFLARE OUTBOX emits `inbox.sync`
        ▼
 USER CANVAS DB — one-way Turso replica sync to device
        │
        ▼
 TARAPP MOBILE CANVAS — panel updates in real time
```

Card metrics are simple views: `SELECT ... FROM records WHERE type='order' AND status='pending'`. Works offline — shows `Saved on phone, will sync when online`.

---

## 9. Building It in `tarapp`

1. **`CanvasScreen.tsx`** — replace flat tool list with Canvas stack; add `<CanvasPanel />` (title + 2 metrics + 1 primary action + tap → detail).
2. **`useCanvasCards` hook** — query local Turso for metrics; filter cards by `access.member.role` + `access.grants`; sort by time context; always include `inbox` filtered to member.
3. **Action Modal Host** — wire card primary buttons to `ActionInterfaceHost.tsx` sheets; secondary actions live inside Detail Screens.
4. **Site Card** — read release status from `tar-sites.tar-54d.workers.dev/<workspace>/` and surface live link + Refero tokens (details inside).
