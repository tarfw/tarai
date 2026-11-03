# TAR = One Live Workspace

## Idea

```text
TAR = workspace platform for commerce + business + personal

Workspace = any SME business (store / delivery / taxi / service / ...)
          + personal (health, tasks, plans)
          open to all — pick a type chip; Jev optional

1 workspace = 1 Rivet actor + 1 SQLite
Members     → private workspace    Customers → store / channels
Phone       → online               Files     → R2
```

One person can create, join and switch workspaces. Each workspace stays separate.
An owner of one workspace can be a member of another (e.g. chef in a restaurant
workspace, driver in a taxi workspace). AI helps; normal work never depends on it.
Design for cheap phones + slow internet.

## App = one home

```text
Sign in → Create / join workspace → HOME (canvas)

HOME
 ├─ header: workspace name → switch
 ├─ NEXT: top items inline, "○" = act now (max 3)
 ├─ work cards: 1–5, per recipe
 │     tap card → section → back to HOME
 ├─ quick actions: tap-automations saved from Ask
 └─ bottom bar: Ask TAR
```

No tab bar. One home, one level of sections.
The workspace sheet groups: OWN section + MEMBER section.

| Screen | Purpose |
|---|---|
| Home (canvas) | Cards with a number + one line each; NEXT; Ask TAR |
| Section | Lists + forms for one card (e.g. Sell, Stock) |
| Detail | One record + its relevant actions |
| Ask | Questions, actions, create automations |
| Settings | Workspace + permissions + integrations + account |

Enable only the features a workspace needs. Reuse lists, forms and details;
give POS or chat its own layout when useful. POS adapts layout from a config
set at onboarding (table#, course grouping for restaurant; barcode/weight for
grocery; meter fare for taxi). No screen per record type.
Role = only permitted information + actions.

## Home by business type

Each card = one number + one line → one section (list + forms).

NEXT shows the top items themselves — up to 3 rows; tap ○ = done (undo), tap row → detail; beyond 3, the card's section lists them.

| Workspace | Work cards |
|---|---|
| Store | Sell · Stock · Money · Reach · People |
| Delivery | Deliveries · Stock · Money · People |
| Food delivery | Deliveries · Money · People |
| Taxi | Trips · Money · People |
| Service / auto | Jobs · Stock · Money · People |
| Personal | Tasks · Health · Plans |

Money and People are always present for work workspaces. Personal has neither — it reuses the same primitives: tasks = work (open → done), habits = daily check-off items, plans = money goals in the ledger.

### Home screens by workspace type

Same home for every type — only the cards change (recipe order):

```text
Store
┌──────────────────────────────┐
│ 9:41                       ● │
│ Aambal Stores            (o) │
├──────────────────────────────┤
│ ○ #12 sari → pack            │
├──────────────────────────────┤
│ ○ #15 rice → pack            │
├──────────────────────────────┤
│ SELL         Rs.12,400 today │
│                              │
├──────────────────────────────┤
│ STOCK            2 items low │
│                              │
├──────────────────────────────┤
│ MONEY    cash+bank Rs.18,450 │
│                              │
├──────────────────────────────┤
│ REACH       12 catalog views │
│                              │
├──────────────────────────────┤
│ PEOPLE 2 team · 10 customers │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

Delivery
┌──────────────────────────────┐
│ 9:41                       ● │
│ Ravi Couriers            (o) │
├──────────────────────────────┤
│ ○ #7 → pick up               │
├──────────────────────────────┤
│ ○ #9 → pick up               │
├──────────────────────────────┤
│ DELIVERIES 8 today · Rs.1,600│
│                              │
├──────────────────────────────┤
│ STOCK            2 items low │
│                              │
├──────────────────────────────┤
│ MONEY     cash+bank Rs.4,300 │
│                              │
├──────────────────────────────┤
│ PEOPLE  2 team · 3 customers │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

Food delivery
┌──────────────────────────────┐
│ 9:41                       ● │
│ Arjun Food delivery      (o) │
├──────────────────────────────┤
│ ○ #23 → pick up              │
├──────────────────────────────┤
│ ○ #31 → drop                 │
├──────────────────────────────┤
│ DELIVERIES 3 active · Rs.640 │
│                              │
├──────────────────────────────┤
│ MONEY            Rs.180 cash │
│                              │
├──────────────────────────────┤
│ PEOPLE  1 team · 3 customers │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

Taxi
┌──────────────────────────────┐
│ 9:41                       ● │
│ Ravi's Taxi              (o) │
├──────────────────────────────┤
│ ○ ride #41 → assign          │
├──────────────────────────────┤
│ ○ ride #38 → assign          │
├──────────────────────────────┤
│ TRIPS    14 today · Rs.2,150 │
│                              │
├──────────────────────────────┤
│ MONEY     cash+bank Rs.5,400 │
│                              │
├──────────────────────────────┤
│ PEOPLE  1 team · 5 customers │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

Service / auto
┌──────────────────────────────┐
│ 9:41                       ● │
│ Kumar Auto Works         (o) │
├──────────────────────────────┤
│ ○ job #12 → parts            │
├──────────────────────────────┤
│ JOBS 4 open · Rs.4,500       │
│                              │
├──────────────────────────────┤
│ STOCK             1 item low │
│                              │
├──────────────────────────────┤
│ MONEY     cash+bank Rs.9,800 │
│                              │
├──────────────────────────────┤
│ PEOPLE   2 team · 1 customer │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

Personal
┌──────────────────────────────┐
│ 9:41                       ● │
│ Meera                    (o) │
├──────────────────────────────┤
│ ○ report due tomorrow        │
├──────────────────────────────┤
│ TASKS                 3 open │
│                              │
├──────────────────────────────┤
│ HEALTH       morning routine │
│                              │
├──────────────────────────────┤
│ PLANS         savings · trip │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘
```

One work shape for all kinds: `kind · status · assignee · customer · amount`.

| Kind | Status flow |
|---|---|
| order (store) | new → packed → done |
| delivery | assigned → picked → delivered |
| trip | requested → ongoing → done |
| job | booked → in progress → done |

Role changes scope, not layout:

| Member | Home sees |
|---|---|
| Owner | all cards, all records |
| Staff | granted cards, all records |
| Driver (delivery / taxi / food delivery) | Work card = "mine today"; Money = own collections; no People |

Customers are not members. They reach the business through Reach (link / WhatsApp) only.

New business type = new recipe row + its status flow. Nothing else.

### Automations

Created from Ask: one trigger + one action → tap = card on home; schedule / event listed in Ask.
Full spec in "Ask + automations" below.

## Create workspace (onboarding)

```text
STEP 1: your type
┌──────────────────────────────┐
│ (1/2) What do you do?        │
│                              │
│  [ Grocery ]   [ Restaurant ]│
│  [ Delivery ]  [ Taxi ]      │
│  [ Service ]   [ Personal ]  │
│                              │
│  or describe: _____________  │
│                              │
│             [ Next ] →       │
└──────────────────────────────┘

STEP 2: your workspace
┌──────────────────────────────┐
│ (2/2) Your workspace         │
│                              │
│ Ravi's Taxi           (edit) │
│  "I run a taxi service"      │
│                              │
│  We set up for you:          │
│  [ Trips ] [ Money ]         │
│  [ People ]                  │
│  [+ add a feature ]          │
│                              │
│     [ Create workspace ]     │
└──────────────────────────────┘
```

```text
Type chips: Grocery / Restaurant / Delivery / Taxi / Service / Personal
    ↓ one tap → recipe loads instantly (works offline)
Typed description? → Jev (1 call) → refine type + feature yes/no + POS hint
    ↓
code → type recipe floor + Jev-suggested extras + POS layout config
    ↓
owner edits chips → [ Create ]  → workspace born
```

- Feature chips are **owned by the user**; Jev only suggests. Editable before create.
- A personal workspace (tasks, health, plans) is created the same way.
  "I want to track my health and morning routine" → Personal: Tasks · Health · Plans.
- Type chips work offline; no Jev key or a Jev failure changes nothing.
- Jev speaks once at birth — photo of a menu / rate card → fills Stock. Never on the sale or reload path.

### Join a workspace

```text
Owner picks role → role link / QR → accept → appears as "MEMBER" in sheet
```

- Owner selects the member's role (driver, staff, chef, ...) before sharing the link.
- Home adapts per role (Driver = "mine today", no People).
- Member can leave; owner can revoke.

## Concept screens (mobile)

Real phone shape: status bar + header + block dividers inside each screen.

```text
HOME (store workspace)
┌──────────────────────────────┐
│ 9:41                       ● │
│ Aambal Stores            (o) │
├──────────────────────────────┤
│ ○ #12 sari order → pack      │
├──────────────────────────────┤
│ SELL         Rs.12,400 today │
│                              │
├──────────────────────────────┤
│ STOCK            2 items low │
│                              │
├──────────────────────────────┤
│ MONEY    cash+bank Rs.18,450 │
│                              │
├──────────────────────────────┤
│ REACH        12 catalog views│
│                              │
├──────────────────────────────┤
│ PEOPLE 2 team · 10 customers │
│                              │
├──────────────────────────────┤
│ ▸ Reorder 50 units     [tap] │
├──────────────────────────────┤
└──────────────────────────────┘

WORK = SELL (tap Sell card)
┌──────────────────────────────┐
│ 9:41                       ● │
├──────────────────────────────┤
│ ← Sell               [+ New] │
├──────────────────────────────┤
│ Today              Rs.12,400 │
├──────────────────────────────┤
│ #12 Sari order       Rs. 950 │
│     → pack now               │
├──────────────────────────────┤
│ #11 Counter          Rs. 200 │
├──────────────────────────────┤
│ #10 WhatsApp        Rs.1,250 │
├──────────────────────────────┤
│ #9 Counter           Rs. 300 │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

SALE (POS)
┌──────────────────────────────┐
│ 9:41                       ● │
├──────────────────────────────┤
│ ← New Sale            [done] │
├──────────────────────────────┤
│ [ search products… ]         │
├──────────────────────────────┤
│ Saree silk   1          −  + │
├──────────────────────────────┤
│ Blouse piece   2        −  + │
├──────────────────────────────┤
│ CART (3)           Rs. 2,450 │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

MONEY
┌──────────────────────────────┐
│ 9:41                       ● │
├──────────────────────────────┤
│ ← Money                      │
├──────────────────────────────┤
│ Cash               Rs. 8,200 │
├──────────────────────────────┤
│ Bank               Rs.10,250 │
├──────────────────────────────┤
│ Today                        │
├──────────────────────────────┤
│ + Received           Rs. 500 │
├──────────────────────────────┤
│ − Expense            Rs. 120 │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

PEOPLE
┌──────────────────────────────┐
│ 9:41                       ● │
├──────────────────────────────┤
│ ← People          [+ Invite] │
├──────────────────────────────┤
│ TEAM                         │
│ Ravi · Owner                 │
├──────────────────────────────┤
│ Meena · Cashier · Shift14    │
├──────────────────────────────┤
│ CUSTOMERS · 12               │
│ Priya · WhatsApp             │
├──────────────────────────────┤
│ Kumar · regular              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
└──────────────────────────────┘

ORDER DETAIL (tap a row)
┌──────────────────────────────┐
│ 9:41                       ● │
├──────────────────────────────┤
│ ← Order #12                  │
├──────────────────────────────┤
│ Sari order · to pack         │
├──────────────────────────────┤
│ 1 Silk saree         Rs. 900 │
│ Delivery              Rs. 50 │
├──────────────────────────────┤
│ TOTAL                Rs. 950 │
├──────────────────────────────┤
│ Paid · UPI ✓                 │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

ASK
┌──────────────────────────────┐
│ 9:41                       ● │
├──────────────────────────────┤
│ ← Ask TAR                    │
├──────────────────────────────┤
│ TAR: how can I help?         │
├──────────────────────────────┤
│ you: who ordered Friday?     │
│ TAR: Priya — 2 orders        │
├──────────────────────────────┤
│ ▸ Sales report · 8am daily   │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
├──────────────────────────────┤
└──────────────────────────────┘

RULES
┌──────────────────────────────┐
│ Home → card → list/detail    │
│          → action            │
├──────────────────────────────┤
│ Sale + Chat own layout       │
├──────────────────────────────┤
│ role filters read+action     │
├──────────────────────────────┤
│ no screen per record type    │
├──────────────────────────────┤
│ low stock: warn, never block │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
│                              │
└──────────────────────────────┘
```

## Store recipe = first build

```text
Create workspace → add products → share store / WhatsApp
                 → receive order or make sale → stock + money update

Home → Sell → New sale → choose products → review → payment → receipt
Home → Sell → order → detail → fulfill
Home → Stock → products / adjust / low stock / purchases
Home → Reach → catalog / share link / WhatsApp
Home → NEXT → open work → take action
```

| Home card | Shows on card | Opens |
|---|---|---|
| Sell | today's total (to-pack = NEXT items) | New sale / orders / history / invoices |
| Stock | low-stock count | Products / adjustments / purchases |
| Money | cash + bank | Receipts / payments / expenses |
| Reach | store link + view count | Store / share |
| People | team + customers | Members / customers / tasks |

## Data = clear records

```text
SQLite = workspace + members + customers + business records + money
       + tasks + automations
Store  = one work table (kind: order / delivery / trip / job) + work lines + stock
R2     = photos + documents
```

Use the tables, indexes and constraints the data needs. Prices, stock and
payment status stay in SQLite. A sale can contain many product lines.

| Rule | Meaning |
|---|---|
| Transaction | Sale + lines + stock commit together |
| Stable ID | Retry = same result, not a duplicate |
| Stock | Never block a counter sale — stock can go negative → reconcile item. Web order: deduct on order, restore on cancel |
| Money | Integer minor units; one append-only ledger — cash / bank in·out + party balance (credit); a payment = a ledger row on the work id |
| Correction | Linked reversal; external payments use actual refund flow |
| Order | One work row: channel (pos / web / whatsapp) + status (new → packed → done) + paid (unpaid / part / full); POS = insert as done |
| Totals | Indexed queries first; cache only when measured |
| Time | Store UTC; use workspace time zone for business days |

## Access + safety

```text
Member request → authenticate → current role + permission → gate → commit
Customer       → scoped public access → order
Payment event  → verify provider + event ID → update payment
Publish *.tar.site / mass message → risk check (abuse / spam)
```

- Check permissions on every read + action; handle revoked sessions.
- Sensitive actions + AI-suggested money / messages → human approval.
- Secure uploads + private files; keep secrets server-side.
- Preserve financial history + audit important changes.

## Ask + automations

```text
Words / photo / import → Ask → TAR answers or acts

One-time:   Ask "who ordered Friday?"     → answer → done
            Ask "create PO for 50 units"   → confirm → done

Automation: Ask "every morning send sales report"
            → TAR plans: schedule 08:00 → send report
            → user confirms → runs daily 08:00; listed in Ask
```

```text
Automation = one trigger + one action
  trigger: tap | schedule (HH:mm) | event (stock < N, order placed, ...)
  action:  one registered action with inputs

No multi-step flows. Tap = card on HOME; schedule / event = listed in Ask.
```

| Rule | Meaning |
|---|---|
| Model | LLM / Jev only where useful; validate output + measure cost |
| Execution | Confirmed automations run without a model; no unrestricted SQL |
| Safety | Money + customer actions always need human confirm |
| Reliability | Scheduled / event automations survive restarts and retries safely |

## Store + channels + network

| Feature | Plan |
|---|---|
| Store | Curated `*.tar.site` = live catalog read (cache purged on edit) — prices update instantly |
| WhatsApp | Shareable link first; opening WhatsApp ≠ message sent |
| Channels | Add reviewed official WhatsApp / Telegram adapters when needed |
| Payments | Verified provider events; workspace owns payment state |
| Custom site | Later: isolated sandbox for visuals; workspace owns business rules |
| Offline mode | Later: local queue + replay; launch online-only |
| Workspace ↔ workspace | Later: durable, idempotent delivery + explicit reconciliation / settlement |

## Delivery

```text
1. STORE LAUNCH
   workspace + roles + products + POS + orders + stock + money
   + curated store + WhatsApp sharing

2. RELIABLE DAILY USE
   live updates + notifications + GST + imports
   + audit + backup / restore

3. ASSISTANCE + TEAM
   Ask + automations + tasks + staff + useful integrations

4. EXPANSION
   custom sites + advanced channels + workspace-to-workspace trade
   + other business types, driven by real demand
```

Move safety or reliability work earlier if first customers need it.

## Deploy + verify

```text
Rivet 3 preview → workspace actors → WarpDrive / S3
                                  → R2 for application files
Start small → measure → add nodes / availability zones when justified
```

Pin versions. Verify storage, recovery + actual costs. Vendor benchmarks ≠
guaranteed app latency.

**Before launch:** test the store journey + workspace isolation + permissions
+ retries + stock conflicts + payment events + actor restarts
+ delivery failures + backup restore.
