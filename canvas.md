# Canvas — The Living Operational Surface

> **The Idea in One Line:**  
> Instead of a static drawer of tool icons, a workspace presents a **Canvas of living Cards (Panels)** inspired by glanceable, card-based AI dashboards. Each card is an active lens into a Tool or Flow, showing real-time facts, dual-metric tiles, and 1-tap actions—projected strictly by the user's role and workspace access.

---

## 1. Concept Equalities & Core Formulas

```text
Canvas   = Cards(Workspace, User, Role, Context)
Card     = Header + Glance(Records) + Launch(Action) + Status(T.Effects, T.Reach)
FlowCard = Flow.Run + Step.Current + Progress(Run.Steps) + Launch(Step.Action)
Access   = Capabilities(Workspace) ∩ Role(Member) ∩ Grants(Member)
Safety   = Reach ∈ {money, customer} ⟹ Requires Confirm(Owner)
Truth    = Canonical Records(Turso) ──[Gateway Commit]──► Events ──► Canvas Sync
```

### Notion-Style Definition Matrix

| Concept | Plain Meaning | Human-Readable Formula | Example in Production |
| :--- | :--- | :--- | :--- |
| **`Workspace`** | The business boundary | `W = (TursoDB, Members, Caps, Site)` | Northstar Restaurant (`w_northstar`) |
| **`Canvas`** | The active surface of cards | `Canvas = ⋃ Card(T) ∀ T ∈ Authorized` | Home screen for Kanimozhi (Cashier) |
| **`Card`** | One living glanceable panel | `Card(T) = Header + Metrics + Action` | Cash Drawer: `₹4,350 in drawer` + `[Count]` |
| **`Tool`** | Atomic business software unit | `T = (In → Out, Effects, Roles, Reach)` | `pos`, `register`, `order`, `inventory` |
| **`Flow`** | Ordered chain of tool steps | `Flow = Tₙ ∘ … ∘ T₁` | Store Closing: Count Cash → Post Report → Lock |
| **`Run`** | An active execution of a flow | `Run = Flow @ IdempotencyKey` | Closing Run #104 (Step 2 of 3) |
| **`Role`** | A person's duties in workspace | `Role ∈ {owner, admin, member, guest}` | Kanimozhi = `member` (Work Role: Cashier) |
| **`Reach (ρ)`** | Danger level / blast radius | `ρ ∈ {none, data, customer, money}` | `money` (pos, payment, invoice, register) |
| **`Gate`** | Code enforcement checkpoint | `Exec(T) ⟺ Actor ∈ T.Roles ∧ Checked(ρ)` | Gateway verifies version, token, and role |

---

## 2. Sequential ASCII Concept Screens

Everything in TAR starts from the owner's initial brief and flows naturally down to role-based Canvas panels and instant action interfaces.

```text
OWNER BRIEF ──► JEV SELECTS CARDS ──► INVITE MEMBERS ──► ROLE CANVAS ──► 1-TAP ACTION
```

---

### Screen 1: Workspace Creation & Business Brief

The owner describes their enterprise in everyday language. No database setup, no complex configuration menus.

```text
+-------------------------------------------------------------+
| TAR · New Workspace                                [Cancel] |
+-------------------------------------------------------------+
|                                                             |
| Name your workspace                                         |
| [ Aambal Neyvagam                                         ] |
|                                                             |
| Describe what you do and sell:                              |
| +---------------------------------------------------------+ |
| | Handloom weaving atelier in Salem. We weave silk and    | |
| | cotton sarees, run a busy retail counter with UPI/cash, | |
| | ship orders across Tamil Nadu, and need an online shop. | |
| +---------------------------------------------------------+ |
|                                                             |
| 💡 Jev will identify your trade and place the right cards  |
|    on your Canvas automatically.                            |
|                                                             |
| [ Generate Workspace & Canvas ]                             |
+-------------------------------------------------------------+
```

---

### Screen 2: Review Your Canvas Cards

Jev (TypeSafe System One) classifies the trade and selects the starting cards for your shop. The owner reviews and opens the workspace in 1 tap.

```text
+-------------------------------------------------------------+
| ‹ Back                  Your Shop Canvas            [Ready] |
+-------------------------------------------------------------+
| AAMBAL NEYVAGAM · Salem                                     |
| Trade detected: Handloom & Apparel Atelier (95% match)      |
|                                                             |
| CARDS ON YOUR CANVAS (Jev selected 5 cards for you):        |
| +---------------------------------------------------------+ |
| | [x] 🏪 Counter Sales       Fast billing, cash drawer & UPI|
| | [x] 📦 Orders & Shipping   Pack sarees, print slips       |
| | [x] 🏷️ Products & Stock    Prices, photos, low-stock alert|
| | [x] 🌐 Online Store        aambal.tar.site (Live on edge) |
| | [x] 🔄 Evening Closing     Count cash, lock drawer, alert |
| +---------------------------------------------------------+ |
|                                                             |
| 💡 You can tap any card to start working, or add more cards |
|    anytime using "+ Add card".                              |
|                                                             |
| [ Confirm & Open Canvas ]                                   |
+-------------------------------------------------------------+
```

---

### Screen 3: Add Member & Card Access

The owner adds staff. Jev suggests role duties and eligible cards based on plain text.

```text
+-------------------------------------------------------------+
| ‹ Back             Add Team Member                  [Done]  |
+-------------------------------------------------------------+
| Workspace: Aambal Neyvagam                                  |
|                                                             |
| Member phone or email:                                      |
| [ kanimozhi@aambal.in                                     ] |
|                                                             |
| What will this person do?                                   |
| +---------------------------------------------------------+ |
| | Counter cashier. Handles sales, counts cash drawer, and | |
| | packs daily orders. Does not edit product prices.       | |
| +---------------------------------------------------------+ |
|                                                             |
| CARDS KANIMOZHI CAN SEE & USE (Jev evaluated)               |
| +---------------------------------------------------------+ |
| | [x] 🏪 Counter Sales (`pos.open`, `pos.checkout`)        | |
| | [x] 💳 Cash Drawer (`pos.register.count`, `.open`)       | |
| | [x] 📦 Order Fulfillment (`order.fulfill`)               | |
| | [ ] 🏷️ Products & Prices (`price.set` - Restricted)      | |
| | [ ] 🌐 Online Store Studio (`site.publish` - Restricted) | |
| +---------------------------------------------------------+ |
|                                                             |
| Assigned Role: Member (Cashier)                             |
|                                                             |
| [ Save & Send Invitation ]                                  |
+-------------------------------------------------------------+
```

---

### Screen 4: Master Canvas Screen (Owner View — Hark AI Inspiration)

The core **Canvas** screen in `tarapp`. Built as a dark, glanceable stack of rich modular panels. Notice the header tabs, urgent banner, Jev Next Action, split-metric panels, and bottom Ask bar.

```text
+-------------------------------------------------------------+
| 2:07 🛜                                                🔋 98%|
|                                                             |
|  (+)     ( Canvas )         Flows         Site        (👤)  |
|           Active                                            |
+-------------------------------------------------------------+
| ⚠️  ALERT                                                   |
| Shift #14 Cash Drawer has ₹350 variance. Tap to review.  ›  |
+-------------------------------------------------------------+
|                                                             |
| ⚡ JEV NEXT ACTION                                           |
| [ Complete ]  Dispatch Order #42 to Senthamizh (Due 15m)    |
|                                                             |
+-------------------------------------------------------------+
| 🏪  Aambal Neyvagam · Counter Sales                         |
|                                                             |
|   Today's Sales               Active Shift Cash             |
|   ₹18,450                     ₹4,350                        |
|                                                             |
|   14 bills cleared · Net UPI: ₹14,100                       |
|   +-------------------------------------------------------+ |
|   | [ New Counter Sale ]               [ Drawer Count ]   | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
| 📦  Orders & Fulfillment                                    |
|                                                             |
|   Pending Packing             Dispatched Today              |
|   3 orders                    11 orders                     |
|                                                             |
|   Next: Saree parcel for Senthamizh (Chennai Speed Post)    |
|   +-------------------------------------------------------+ |
|   | [ Open Order Queue ]              [ Scan Barcode ]    | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
| 🌐  Online Storefront · aambal.tar.site                     |
|                                                             |
|   Store Visits Today          WhatsApp Enquiries            |
|   142                         8                             |
|                                                             |
|   Theme: arte* (Copper & Citron) · Status: Live on Edge     |
|   +-------------------------------------------------------+ |
|   | [ Edit Products ]                 [ View Store ↗ ]    | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
| 🔄  Shop Closing Routine                                    |
|                                                             |
|   Step 2 of 4                 Drawer Balance                |
|   Count Cash                  ₹4,350 Match                  |
|                                                             |
|   [=======================>            ] 50% Complete       |
|   +-------------------------------------------------------+ |
|   | [ Resume Closing Flow › ]                             | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
|                                                             |
|             +---------------------------------+             |
|             |     +  Create a new panel       |             |
|             +---------------------------------+             |
|                                                             |
| +---------------------------------------------------------+ |
| |  Message TAR...                                   (+) 🎙 | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

### Screen 5: Filtered Canvas Screen (Staff / Cashier View)

When Kanimozhi (Cashier) signs into the same workspace, her Canvas is automatically filtered by her access grants. Store revenue totals, site design tools, and admin settings do not exist on her surface.

```text
+-------------------------------------------------------------+
| 2:07 🛜                                                🔋 98%|
|                                                             |
|  Aambal Neyvagam · Kanimozhi (Cashier)                 (👤)  |
|  Role: Member · Shift #14 Active                            |
+-------------------------------------------------------------+
| ⚡ YOUR NEXT TASK                                            |
| Pack parcel for Senthamizh (Order #42) · 2 items            |
+-------------------------------------------------------------+
| 💳  Counter Register · Shift #14                            |
|                                                             |
|   Bills Cleared               Drawer Cash                   |
|   9 bills                     ₹4,350                        |
|                                                             |
|   Opened at 10:00 AM · Float: ₹2,000                        |
|   +-------------------------------------------------------+ |
|   | [ Quick Sale (POS) ]               [ Cash Count ]     | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
| 📦  Order Packing Queue                                     |
|                                                             |
|   To Pack                     Packed                        |
|   2 items                     7 items                       |
|                                                             |
|   Next: Ponizhai Karai Paruthi Veshti (1x)                  |
|   +-------------------------------------------------------+ |
|   | [ Start Packing Next ]             [ Print Slip ]     | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
| 🔄  Shift Handover Flow                                     |
|                                                             |
|   Handover Ready              Pending Tasks                 |
|   4:00 PM                     0 blocking                    |
|                                                             |
|   +-------------------------------------------------------+ |
|   | [ Start Shift Handover Flow › ]                       | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
| +---------------------------------------------------------+ |
| |  Ask TAR a question...                            (+) 🎙 | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

### Screen 6: Card Deep Dive — Atomic Tool Panel Anatomy

Every panel is structured with mathematical consistency. Dual metrics on top, live context in the middle, and 1-tap actions on the bottom.

```text
+-------------------------------------------------------------+
| [Icon]  Title · Scope / Context                     [Badge] |
|                                                             |
|   Metric 1 Tile               Metric 2 Tile                 |
|   Primary Value               Secondary Value               |
|                                                             |
|   Context Subtitle / Last Synchronized / Safety Cue         |
|   +-------------------------------------------------------+ |
|   | [ Primary Action ]               [ Secondary Action ] | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

```text
+-------------------------------------------------------------+
| 🏪  Point of Sale · Counter Counter #1            [ONLINE]  |
|                                                             |
|   Items in Cart               Total Amount                  |
|   2 items                     ₹5,350                        |
|                                                             |
|   Customer: Senthamizh (+91 98401 23456)                    |
|   +-------------------------------------------------------+ |
|   | [ Open POS Checkout ]             [ Barcode Scan ]    | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

### Screen 7: Card Deep Dive — Flow Checklist Panel Anatomy

Flows chain registered tool actions into ordered, resumable steps.

```text
+-------------------------------------------------------------+
| 🔄  Flow: Evening Shop Closing                   [STEP 2/4] |
|                                                             |
|   Current Step                Assigned To                   |
|   Count Cash Drawer           Kanimozhi                     |
|                                                             |
|   Step 1: Save final day invoices (Completed at 8:45 PM)    |
|   Step 2: Physical cash audit & register reconciliation     |
|   Step 3: Send closing summary to Kayalvizhi on Telegram    |
|   Step 4: Lock register & close shift                       |
|                                                             |
|   [========================>           ] 50% Completed      |
|   +-------------------------------------------------------+ |
|   | [ Perform Step 2: Count Cash ]     [ Skip Step ]      | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

### Screen 8: Card Deep Dive — Site Storefront Panel Anatomy

Reflecting the autonomous site engine from `parai.md`, this panel lets the owner monitor and steer their web store with zero code.

```text
+-------------------------------------------------------------+
| 🌐  Online Storefront · aambal.tar.site             [LIVE]  |
|                                                             |
|   Catalog Items               Weekly Visits                 |
|   24 published                892                           |
|                                                             |
|   Design System: arte* (Refero Token System)                |
|   Palette: [● Copper] [● Wheat] [● Citron] [● Charcoal]    |
|   SEO: 100% Valid · Edge CDN: Cloudflare R2 + Workers       |
|   +-------------------------------------------------------+ |
|   | [ Switch Design System ]          [ Edit Products ]   | |
|   | [ View Storefront ↗ ]             [ WhatsApp Orders ] | |
|   +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

### Screen 9: Action Execution Screen (Sheet / Host Modal)

Tapping any action button on a card instantly opens its registered Action Interface without navigating away from the workspace context.

```text
+-------------------------------------------------------------+
| ‹ Close           Point of Sale Checkout                    |
+-------------------------------------------------------------+
| AAMBAL NEYVAGAM · Kadanai                         Shift #14 |
|                                                             |
| CART ITEMS (2)                                              |
| 1. Semparuthi Pattu Selai (Sivappu)                 ₹4,500  |
| 2. Ponizhai Karai Paruthi Veshti                      ₹850  |
| ----------------------------------------------------------- |
| TOTAL DUE                                           ₹5,350  |
|                                                             |
| SELECT PAYMENT METHOD                                       |
| [*] UPI QR (Show on screen)     [ ] CASH     [ ] CARD       |
|                                                             |
| Customer WhatsApp (for instant bill PDF):                   |
| [ +91 98401 23456 (Senthamizh)                            ] |
|                                                             |
| 🔒 SAFETY: Commit writes atomic order + invoice + payment   |
|                                                             |
| [ Complete Sale · ₹5,350 ]                                  |
+-------------------------------------------------------------+
```

---

### Screen 10: Canvas Card Customization Modal (`+ Create a new panel`)

Users can add or rearrange panels on their canvas to suit their daily workflow.

```text
+-------------------------------------------------------------+
| ‹ Back                 Add Panel to Canvas          [Done]  |
+-------------------------------------------------------------+
| Available cards based on your role (Owner):                 |
|                                                             |
| TOOL PANELS                                                 |
| [x] Counter Sales (POS)                [ Added ]            |
| [x] Cash Register Shift                [ Added ]            |
| [x] Orders & Packing                   [ Added ]            |
| [x] Online Storefront                  [ Added ]            |
| [ ] Stock & Low Inventory              [ + Add ]            |
| [ ] Supplier Purchases & PO            [ + Add ]            |
| [ ] Daily Expenses Log                 [ + Add ]            |
|                                                             |
| FLOW CHECKLIST PANELS                                       |
| [x] Evening Shop Closing               [ Added ]            |
| [ ] Morning Shop Opening               [ + Add ]            |
| [ ] Weekly Stock Audit                 [ + Add ]            |
|                                                             |
| [ Save Canvas Layout ]                                      |
+-------------------------------------------------------------+
```

---

## 3. The 18 Canonical Tools as Canvas Panels

Every tool in TAR maps directly to a high-impact Canvas Card.

| Tool ID | Panel Name | Kind | Reach (`ρ`) | Glance Metrics | Primary Card Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`pos`** | Counter Sales | `tool` | `money` | Cart total, bills cleared today | `[ New Counter Sale ]` |
| **`register`** | Cash Drawer | `tool` | `money` | Physical cash on hand, shift float | `[ Count Cash ]` |
| **`item`** | Products & Prices | `tool` | `data` | Active SKUs, draft items | `[ Add Product ]` |
| **`inventory`** | Stock & Warehouse | `tool` | `data` | Units on hand, low-stock warnings | `[ Adjust Stock ]` |
| **`order`** | Orders & Dispatch | `tool` | `customer` | Orders waiting packing, shipping | `[ Open Queue ]` |
| **`invoice`** | Billing & GST | `tool` | `money` | Outstanding receivables, bills issued | `[ Issue Bill ]` |
| **`payment`** | Payments & UPI | `tool` | `money` | Today's UPI receipts, cash drops | `[ Record Receipt ]` |
| **`expense`** | Daily Expenses | `tool` | `money` | Petty cash spent (tea, packing, fuel) | `[ Log Expense ]` |
| **`purchase`** | Supplier POs | `tool` | `money` | Orders placed, inbound shipments | `[ New PO ]` |
| **`members`** | Team & Shifts | `tool` | `data` | Active on-duty staff, roles | `[ Manage Staff ]` |
| **`contact`** | Customer Ledger | `tool` | `customer` | Total contacts, wholesale buyers | `[ Add Contact ]` |
| **`human`** | Manual Tasks | `human` | `none` | Physical jobs assigned to you | `[ Mark Complete ]` |
| **`flow`** | Shop Checklists | `flow` | `none` | Active routines, percent completion | `[ Resume Flow ]` |
| **`site`** | Online Storefront | `site` | `customer` | Unique visits, WhatsApp enquiries | `[ View Store ↗ ]` |
| **`inbox`** | Team Feed | `channel` | `none` | Unassigned tasks, waiting reviews | `[ Open Feed ]` |
| **`chat`** | WhatsApp Chat | `tool` | `customer` | Pending customer customer chats (`wa.me`)| `[ Open WhatsApp ]` |
| **`whatsapp`** | WhatsApp API | `channel` | `customer` | Automated PDF bills dispatched | `[ Check Delivery ]` |
| **`telegram`** | Shop Alerts | `channel` | `none` | Low-stock pings, closing notices | `[ Send Alert ]` |

---

## 4. Flows on Canvas (Compound Tools)

A Flow is simply tools composed in series:

```text
Flow F := Stepₙ ∘ … ∘ Step₁
```

### Flow Execution Rules on Canvas

1. **Self-Contained Run State:** An active flow run displays directly on the Canvas as an interactive card with a visual progress bar.
2. **Per-Step Atomic Commits:** Each step commits as an isolated transaction with idempotency key:
   $$\text{Key} = \texttt{flow:}\{\text{runId}\}\texttt{:}\{\text{stepIndex}\}$$
3. **Step Handoff:**
   - **`auto` steps:** Background actions like `record.create`, `task.create` run automatically without pausing the UI.
   - **`interactive` steps:** Actions with reach `money` or `customer` pause and display an action button (`[ Perform Step ]`) for the member to execute.
4. **Resumable from Any Device:** If Kanimozhi counts the cash drawer on the POS tablet, Kayalvizhi instantly sees Step 2 turn green on her phone's Canvas.

---

## 5. Role, Authority & Projection Algebra

How the Canvas decides what cards to display:

$$\text{VisibleCards} = \text{Filter}\Big(\text{RegisteredCards},\; \text{MemberRole},\; \text{Grants},\; \text{Context}\Big)$$

```text
+-------------------------------------------------------------+
| STEP 1: RESOLVE CONTEXT                                     |
| Time + Timezone + Routine + Manual Hold                     |
|                   │                                         |
|                   ▼                                         |
| STEP 2: CHECK WORKSPACE CARDS                               |
| Workspace enabled: pos=true, order=true, site=true          |
|                   │                                         |
|                   ▼                                         |
| STEP 3: CHECK MEMBER ROLE & CARD GRANTS                     |
| Member = Kanimozhi (Cashier)                                |
| Card Access = [Counter Sales, Cash Drawer, Packing]         |
| Excludes    = [Products & Prices, Store Studio, Team Admin] |
|                   │                                         |
|                   ▼                                         |
| STEP 4: PROJECT CANVAS CARDS                                |
| Surfaced: [POS Panel], [Register Panel], [Packing Panel]    |
| Hidden:   [Revenue Summary], [Site Studio], [Team Grants]   |
+-------------------------------------------------------------+
```

### Role Matrix

| Card / Action | Owner | Admin | Member (Cashier) | Guest |
| :--- | :---: | :---: | :---: | :---: |
| **Counter Sales (`pos`)** | Full | Full | Execute Only | Denied |
| **Cash Drawer (`register`)** | Full | Full | Shift Only | Denied |
| **Store Revenue Summary** | Full | Full | Hidden | Denied |
| **Order Packing (`order`)** | Full | Full | Full | Denied |
| **Pricing & Catalog (`item`)**| Full | Full | View Only | Denied |
| **Storefront Studio (`site`)**| Full | Full | View Only | Public View |
| **Team & Grants (`members`)** | Full | Full | Hidden | Denied |

---

## 6. Data Architecture & Synchronous Truth

Cards never communicate with messy peer-to-peer webhooks. Everything writes to canonical Turso records, enqueues an event, and projects to the user's local Canvas.

```text
 ┌──────────────────────┐
 │ MEMBER TAPS CARD     │
 │ "Complete Sale"      │
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ ACTION GATEWAY       │
 │ Validates:           │
 │  1. Bearer Token     │
 │  2. Role Grants      │
 │  3. Idempotency Key  │
 │  4. Data Version     │
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐        ┌──────────────────────┐
 │ TURSO WORKSPACE DB   │ ─────► │ CLOUDFLARE OUTBOX    │
 │ Writes canonical     │        │ Emits `inbox.sync`   │
 │ `records` row        │        │ to active members    │
 └──────────────────────┘        └──────────┬───────────┘
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ USER NOW/CANVAS DB   │
                                 │ Turso replica syncs  │
                                 │ one-way to device    │
                                 └──────────┬───────────┘
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ TARAPP MOBILE CANVAS │
                                 │ Panel updates in     │
                                 │ real-time (<100ms)   │
                                 └──────────────────────┘
```

---

## 7. Next Steps for Implementation in `tarapp`

1. **`CanvasScreen.tsx` Component**:
   - Refactor `tarapp/src/app/(home)/tools.tsx` to mount the Hark-inspired Canvas layout instead of a flat tool list.
   - Introduce `<CanvasPanel />` supporting split metrics, badge status, and embedded action triggers.
2. **`useCanvasCards` Hook**:
   - Query local Turso database for live metrics (e.g. today's cash balance, open orders, live site status).
   - Filter available cards dynamically using `access.member.role` and `access.grants`.
3. **Action Modal Host**:
   - Connect card action buttons directly to `ActionInterfaceHost.tsx` for seamless, 1-tap sheet launches.
4. **Site Storefront Card**:
   - Read active release status from the Sites Worker (`tar-sites.tar-54d.workers.dev/<workspace>/`) and surface the live link and Refero design tokens.
