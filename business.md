# Business — Complete Operational Architecture

> **The Master Formula:**  
> $$\text{Complete Business (110 Capabilities)} = \text{18 Tool Cards} + \text{Flows} + \text{Universal Records} + \text{Balanced Postings} + \text{Projections}$$
> 
> A complete business runs on 110 operational capabilities across 14 stages:  
> **Plan → Source → Stock → Make → Catalog → Sell → Order-to-Cash → Money → People → Serve → Move → Comply → Communicate → Manage**  
> 
> Traditional ERPs build 110 heavy modules with hundreds of tables.  
> TAR achieves 100% coverage with **5 lean primitives**, zero software bloat, and pure mobile-first ASCII concept screens.

---

## 1. The 5 Primitives in One Table

| Primitive | Plain Meaning | How It Operates | Example |
| :--- | :--- | :--- | :--- |
| **`1. Tool Card`** | 1-tap mobile UI engine | Active panel with dual metrics & actions | `pos`, `register`, `order`, `inventory` |
| **`2. Flow (SOP)`** | Ordered multi-step checklist | Chains actions into resumable runs (`Tₙ ∘ … ∘ T₁`) | Shop Closing, Production Run, Stocktake |
| **`3. Record`** | Single Turso table row | Universal `records` table with typed `data` | `type='item'`, `type='stock'`, `type='recipe'` |
| **`4. Posting`** | Double-entry accounting row | Automated balanced debits & credits in background | Sale: Debit Cash/UPI, Credit Sales Revenue |
| **`5. Projection`** | Read-only SQL / Jev view | Real-time markdown/HTML reports from records | P&L, GST return export, demand forecast |

---

## 2. Core Business Concept Screens

Visual walkthrough showing how all 14 stages operate on clean mobile surfaces.

---

### Screen 1: Sourcing & Goods Receipt (Source & Stock Stages — GRN & AP)

Receiving goods from a supplier. Automatically updates stock on hand, logs supplier khata, and posts balanced Accounts Payable.

```text
+-------------------------------------------------------------+
| ‹ Close               Goods Receipt (GRN)         [Confirm] |
+-------------------------------------------------------------+
| SUPPLIER: POONGUZHALI WEAVERS (Erode)             PO #1042  |
|                                                             |
| RECEIVED ITEMS                                              |
| +---------------------------------------------------------+ |
| | Semparuthi Pattu Silk Yarn (Raw)                        | |
| | Ordered: 50.0 kg · Unit Cost: ₹1,200/kg                 | |
| | Received: [ 50.0 kg ]  Batch: [ BATCH-2026-OCT ]        | |
| | Location: [ Godown Rack-A ]                             | |
| +---------------------------------------------------------+ |
|                                                             |
| INVOICE & LANDED COST DETAILS                               |
| Supplier Bill No: [ INV-8891 ]     Bill Date: [ 18-Oct-26 ] |
| Total Bill: ₹60,000                Freight/Packing: ₹1,500  |
| Total Landed Cost: ₹61,500 (₹1,230.00/kg)                   |
|                                                             |
| 🔒 AUTOMATIC ACCOUNTING COMMIT                              |
|   Debit:  Inventory (+50 kg stock)                  ₹61,500 |
|   Credit: Accounts Payable (Poonguzhali Weavers)    ₹60,000 |
|   Credit: Cash Paid (Freight)                        ₹1,500 |
|                                                             |
| [ Accept Goods & Post Ledger ]                              |
+-------------------------------------------------------------+
```

---

### Screen 2: Production / Batch Run (Make & Stock Stages — BOM & Recipes)

Manufacturing finished goods. Consumes raw materials from stock, records scrap/waste, and outputs sellable SKUs.

```text
+-------------------------------------------------------------+
| ‹ Back            Work Order #48 (Weaving)          [Done]  |
+-------------------------------------------------------------+
| RECIPE: Semparuthi Pattu Selai (Sivappu)          Batch #12 |
| Planned Units: 10 sarees · Station: Loom #3                 |
|                                                             |
| 1. DRAW RAW MATERIALS (BOM Auto-Allocated)                  |
|  • Silk Yarn: 4.5 kg consumed from [Godown Rack-A]          |
|  • Gold Zari: 0.5 kg consumed from [Safe Locker]            |
|  Status: Reserved & Drawn from Stock                        |
|                                                             |
| 2. PRODUCTION STATUS                                        |
|  • Units Woven: [ 10 sarees ]                               |
|  • Waste/Scrap: [ 80g yarn ] (Costed to scrap account)      |
|                                                             |
| 3. QUALITY CONTROL INSPECTION                               |
|  [x] Thread tension & selvage pass                          |
|  [x] Color dye consistency verified                         |
|  QC Inspector: Poonguzhali · Status: Approved               |
|                                                             |
| 🔒 COMMIT EFFECT                                            |
|   Decrements Raw Materials → Increments 10 Sellable Sarees  |
|   Unit Cost: ₹4,150.00 per finished saree                   |
|                                                             |
| [ Complete Run & Move to Stock ]                            |
+-------------------------------------------------------------+
```

---

### Screen 3: Counter Sales & Shift Close (Sell & Money Stages — POS & Register)

Counter staff bills customers, collects UPI/Cash, and balances cash shifts with zero arithmetic errors.

```text
+-------------------------------------------------------------+
| ‹ Close           Point of Sale Checkout                    |
+-------------------------------------------------------------+
| AAMBAL NEYVAGAM · Salem                           Shift #14 |
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
| 🔒 POSTING: Debit Cash/UPI ₹5,350 · Credit Sales ₹5,350     |
|             Stock automatically decremented for 2 SKUs      |
|                                                             |
| [ Complete Sale · ₹5,350 ]                                  |
+-------------------------------------------------------------+
```

```text
+-------------------------------------------------------------+
| ‹ Back            Evening Shift Close #14           [Lock]  |
+-------------------------------------------------------------+
| Cashier: Kanimozhi · Till #1                                |
| Opened: 10:00 AM · Closing: 9:00 PM                         |
|                                                             |
| CASH RECONCILIATION                                         |
|  Opening Float:                                     ₹2,000  |
|  Cash Sales Collected:                             ₹14,200  |
|  Petty Cash Expenses Paid (Tea/packing):           - ₹850   |
|  Expected Cash in Drawer:                          ₹15,350  |
|                                                             |
| PHYSICAL CASH COUNTED                                       |
|  [ ₹15,350 ]                                                |
|  Variance: ₹0.00 (Perfect Match)                            |
|                                                             |
| [ Close Shift & Post Closing Journal ]                      |
+-------------------------------------------------------------+
```

---

### Screen 4: Order-to-Cash & Dispatch (Catalog, Sell & Move Stages)

Customer orders from WhatsApp or web store. Staff verifies stock reservation, packs items, prints shipping label, and dispatches.

```text
+-------------------------------------------------------------+
| ‹ Back            Sales Order #42 · Senthamizh     [Status] |
+-------------------------------------------------------------+
| Channel: WhatsApp Storefront · Status: Paid (Razorpay UPI)  |
| Destination: 42 South Cross Rd, Salem · +91 98401 23456     |
|                                                             |
| ORDER ITEMS                                                 |
|  1x Semparuthi Pattu Selai (Sivappu)                ₹4,500  |
|  Stock Status: [ RESERVED (Godown Shelf-B3) ]               |
|                                                             |
| FULFILLMENT & DISPATCH                                      |
|  Carrier: [ India Post Speed Post ]                         |
|  Tracking Number: [ SP-88492019-IN ]                        |
|                                                             |
| +---------------------------------------------------------+ |
| | [ Scan Barcode to Pack ]             [ Print Slip & Label] |
| +---------------------------------------------------------+ |
|                                                             |
| 🔒 Dispatches tracking URL to customer's WhatsApp (+₹0.00)  |
|                                                             |
| [ Mark Dispatched & Clear Reservation ]                     |
+-------------------------------------------------------------+
```

---

### Screen 5: Instant Money & Tax Engine (Money & Comply Stages — P&L & GST)

Zero manual bookkeeping. Real-time balance sheets and GST summaries projected directly from transaction postings.

```text
+-------------------------------------------------------------+
| Aambal Neyvagam · Financial Health                [Export]  |
+-------------------------------------------------------------+
| PERIOD: Current Month (October 2026)                        |
|                                                             |
| PROFIT & LOSS SUMMARY                                       |
|  Total Revenue (POS + Web Store):                 ₹3,42,800 |
|  Cost of Goods Sold (Materials + Production):    - ₹1,88,400 |
|  Gross Profit:                                    ₹1,54,400 |
|  Operating Expenses (Rent, Tea, Logistics):       - ₹38,200 |
|  Net Profit:                                      ₹1,16,200 |
|                                                             |
| TAX SUMMARY (GST Prepared for Filing)                       |
|  Output Tax Collected (Sales):                     ₹17,140  |
|  Input Tax Credit (Purchases):                   -  ₹9,420  |
|  Net GST Payable to Govt:                           ₹7,720  |
|                                                             |
| [ View General Ledger ]             [ Export GST JSON ]     |
+-------------------------------------------------------------+
```

---

### Screen 6: Team, Shifts & Payroll (People & Communicate Stages)

Staff roster, attendance clocking, and monthly wage disbursement with zero paperwork.

```text
+-------------------------------------------------------------+
| Team & Shifts · October 2026                       [Roster] |
+-------------------------------------------------------------+
| ACTIVE STAFF (3 on duty)                                    |
|  • Kanimozhi (Cashier) · Clocked in: 9:58 AM                |
|  • Ilavenil (Packing) · Clocked in: 10:04 AM                |
|  • Poonguzhali (QC & Loom) · Clocked in: 9:30 AM            |
|                                                             |
| MONTHLY PAYROLL RUN (September 2026 Summary)                |
|  Kanimozhi (Cashier): 26 days present · Gross: ₹18,000      |
|  Advances Deducted: ₹2,000 · Net Payable: ₹16,000           |
|                                                             |
| 🔒 One-tap disbursement via UPI/Bank transfer               |
|    Generates digital PDF payslip sent via WhatsApp          |
|                                                             |
| [ Run Payroll & Post Salary Journal ]                       |
+-------------------------------------------------------------+
```

---

## 3. The 110 Capabilities Matrix (Clean & Uncluttered)

Every single capability mapped to its exact TAR primitive, eliminating all redundant sub-systems.

| # | Stage | Capability | TAR Primitive | Action / Contract | Business Effect |
|---|---|---|---|---|---|
| **1-4** | **Plan** | Demand Forecast, S&OP, Budgets, MRP | **Artifact / Flow** | `forecast.generate`, `plan.mrp` | Read-only SQL + BOM expansion; drafts restock POs |
| **5-14** | **Source** | Suppliers, RFQs, POs, Approvals, Goods Receipt (GRN), Landed Cost, AP, Returns | **Tool Card (`purchase`, `contact`)** | `purchase.create`, `purchase.receive`, `purchase.return` | Atomically increments stock; auto-credits Accounts Payable |
| **15-24**| **Stock** | Stock Ledger, Multi-Location, Counts, Transfers, Batches, Serials, Bins, Packing | **Tool Card (`inventory`)** | `stock.adjust`, `stock.transfer` | Versioned `(variant, location)` records; append-only audit trail |
| **25-31**| **Make** | BOM Recipes, Work Orders, Scheduling, WIP, Scrap, Quality Control, Costing | **Record (`recipe`) + Flow** | `production.start`, `production.complete` | Consumes raw materials; inspects and stocks finished units |
| **32-35**| **Catalog**| Product Master, Variants, Units, Multi-Channel Price Lists | **Tool Card (`item`)** | `catalog.item.save`, `price.set` | Integer base units; channel-specific prices (`pos`, `site`, `b2b`) |
| **36-45**| **Sell** | POS Counter, Cash Register, Thermal Print, Offline Sync, Web Store, Cart, Offers | **Tool Card (`pos`, `register`, `site`)** | `pos.checkout`, `pos.register.close`, `site.generate` | 1-tap fast billing, offline SQLite sync, edge web store ($0/visit) |
| **46-52**| **Order** | Quotes, Sales Orders, Reservations, Invoicing (GST), Khata, Reminders, Returns | **Tool Card (`order`, `invoice`)** | `order.create`, `order.fulfill`, `invoice.issue`, `refund.record` | Locks reservations; snapshots tax; updates customer credit ledger |
| **53-68**| **Money** | General Ledger, AP/AR, Bank Rec, Expenses, GST Returns, Fixed Assets, P&L, Audit | **Posting (Double-Entry Engine)** | `payment.record`, `expense.record`, `period.close` | Every transaction writes balanced debits/credits; auto-calculates GST |
| **69-75**| **People**| Employees, Roles, Shifts, Attendance, Leaves, Payroll, Expense Claims | **Tool Card (`members`) + Flow** | `attendance.record`, `payroll.run` | Tracks shift clock-ins; auto-disburses salaries with WhatsApp slips |
| **76-84**| **Serve** | CRM Leads, Pipeline, History, Tickets, Bookings, Milestones, Time Billing | **Tool Card (`contact`)** | `contact.create`, `booking.create`, `task.create` | Customer 360 profile, WhatsApp support tickets, appointment slots |
| **85-89**| **Move** | Carriers, Delivery Routes, Proof of Delivery (POD), Fleet, Trips & Fares | **Tool Card (`order`)** | `order.fulfill`, `trip.complete` | India Post / courier tracking links; driver OTP / photo verification |
| **90-93**| **Comply**| Quality Checks, Licenses, Statutory Dates, Document Vault | **Record + R2 Storage** | `task.create`, Cloudflare R2 | Permanent storage for bills/certificates; alerts 30 days before expiry |
| **94-98**| **Comms** | Tasks, Flows, Team Chat, WhatsApp API, Automated Telegram Alerts | **Tool Card (`inbox`, `whatsapp`, `telegram`)** | `task.complete`, `flow.start` | Zero-cost internal task queue; customer WhatsApp bills; alert pings |
| **99-110**| **Manage**| Dashboards, Reports, Branch Isolation, Approvals, Webhooks, Backups, Settings | **Record + Canvas Panels** | `buildWorkspaceCanvas`, libSQL | Living Canvas panels replace complex BI; Turso distributed replication |

---

## 4. Fundamental Business Invariants (The Laws)

```text
LAW 1: DOUBLE-ENTRY BALANCE   ∑ Debits = ∑ Credits ∀ Committed Business Events
LAW 2: STOCK CONSERVATION     Available = Onhand - Reserved ≥ 0
LAW 3: IMMUTABLE AUDIT        Every mutation appends an Event(actor, timestamp, diff)
LAW 4: ZERO ERP BLOAT         No new tables per vertical; use canonical records with typed data
LAW 5: OWNER SAFETY FLOOR     Any step moving Money or contacting Customers requires confirmation
```

---

## 5. Summary

By replacing 110 disconnected software applications with **18 Canvas Cards + Flows + Universal Records + Automated Double-Entry + Projections**, TAR gives small merchants and businesses the full operational power of an enterprise ERP in an interface as simple and intuitive as a chat app.
