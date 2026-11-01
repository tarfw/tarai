# TAR = One Live Workspace

## Idea

```text
TAR = workspace platform for commerce + business + personal

Workspace = any SME business (store / delivery / taxi / service / ...)
          + personal (health, tasks, plans)
          open to all — Jev types the business from description

1 workspace = 1 Rivet actor + 1 SQLite
Members     → private workspace    Customers → store / channels
Phone       → online + offline     Files     → R2
```

One person can create, join and switch workspaces. Each workspace stays separate.
An owner of one workspace can be a member of another (e.g. chef in a restaurant
workspace, driver in a taxi workspace). AI helps; normal work never depends on it.
Design for cheap phones + slow internet.

## App = one home

```text
Sign in → Create / join workspace → HOME (canvas)

HOME
 ├─ header: workspace name → switch   |   tray → Inbox
 ├─ NEXT: top urgent item
 ├─ work cards: from recipe (Sell · Stock · Money · Reach · People)
 │     tap card → section → back to HOME
 ├─ automations: user-saved from Ask (tap / schedule / event)
 └─ bottom bar: Ask TAR
```

No tab bar. One home, one level of sections.
The workspace sheet groups: OWN section + MEMBER section.

| Screen | Purpose |
| --- | --- |
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

One home for every workspace. Only the cards change, from a recipe. No new screens per type.
Jev types the business from description; code picks a built-in recipe as floor.
New recipes added when needed — no new screens.

```text
HOME = NEXT
     + work cards   1–5, per recipe
     + automations  user-saved from Ask (tap / schedule / event)
     + Ask TAR      bottom bar
```

Each card = one number + one line → one section (list + forms).

| Workspace | Work cards |
| --- | --- |
| Store | Sell · Stock · Money · Reach · People |
| Delivery | Deliveries · Stock · Money · People |
| Taxi | Trips · Fares · Money · People |
| Service / auto | Jobs · Stock · Money · People |
| Personal | Tasks · Health · Plans |

Money and People are always present for work workspaces. Personal has neither.

One work shape for all kinds: `kind · status · assignee · customer · amount`.

| Kind | Status flow |
| --- | --- |
| order (store) | new → packed → done |
| delivery | assigned → picked → delivered |
| trip | requested → ongoing → done |
| job | booked → in progress → done |

Role changes scope, not layout:

| Member | Home sees |
| --- | --- |
| Owner | all cards, all records |
| Staff | granted cards, all records |
| Driver (delivery / taxi) | Work card = "mine today"; Money = own collections; no People |

Customers are not members. They reach the business through Reach (link / WhatsApp) only.

### Automations

Users create automations from Ask. One trigger + one action. Saved as a card on home.

```text
Ask TAR: "every morning send me yesterday's sales report"
    ↓
TAR plans: automation = schedule 08:00 → send report
    ↓
User confirms → card appears on home
```

| Trigger | Example |
| --- | --- |
| tap | "restock alert" — tap to check low stock |
| schedule (HH:mm) | "every morning at 8, send sales report" |
| event | "if stock below 10, create PO to vendor" |

One automation = one trigger + one action. Chain automations by same event
(e.g. "send PO" + "notify vendor" = two automations, same event).
Max 8 automations per workspace.

New business type = new recipe row + its status flow. Nothing else.

## Create workspace (onboarding)

Two steps. One description → Jev suggests → owner edits → create.

```text
STEP 1: describe                        STEP 2: your workspace
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ (1/2) What do you do?        │        │ (2/2) Your workspace         │
│                              │        │                              │
│  "I run a taxi service"      │        │ Ravi's Taxi           (edit) │
│  I take riders across        │        │  "I run a taxi service"      │
│  the city.                   │        │                              │
│                              │        │  We set up for you:          │
│                              │        │  [ Fares ] [ Trips ]         │
│                              │        │  [ Riders ] [ Team ]         │
│                              │        │  [+ add a feature ]          │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│             [ Next ] →       │        │     [ Create workspace ]     │
└──────────────────────────────┘        └──────────────────────────────┘
```

```text
One sentence
    ↓
Jev (1 call)  → type: any (store / delivery / taxi / auto / service / personal / ...)
              → risk (abuse / spam)
              → one yes/no per feature: "does this business need Fares?"
              → POS layout hint: "restaurant" → table# + course grouping
    ↓
code → type recipe floor + Jev-suggested extras + POS layout config
    ↓
owner edits chips → [ Create ]  → workspace born
```

- Feature chips are **owned by the user**; Jev only suggests. Editable before create.
- A personal workspace (tasks, health, plans) is created the same way.
  "I want to track my health and morning routine" → Personal: Tasks · Health · Plans.
- No Jev key / failure → code picks type from keywords + default recipe.
- Jev speaks once at birth. Never on the sale or reload path.
- New business types = new recipes added when driven by real demand.

### Join a workspace

```text
Owner invites → link / QR → accept → appears as "MEMBER" in workspace sheet
```

- Invited member picks their role (driver, staff, chef, ...).
- Home adapts per role (Driver = "mine today", no People).
- Member can leave; owner can revoke.

## Concept screens (mobile)

Real phone shape: status bar + header + block dividers inside each screen.

```text
HOME (store workspace)                  WORK = SELL (tap Sell card)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 9:41                       ● │        │ 9:41                       ● │
├──────────────────────────────┤        ├──────────────────────────────┤
│ Aambal Stores            (o) │        │ ← Sell               [+ New] │
│ Manager                     │        ├──────────────────────────────┤
├──────────────────────────────┤        │ Today              Rs.12,400 │
│ ! 2 orders → pack            │        ├──────────────────────────────┤
├──────────────────────────────┤        │ #12 Sari order       Rs. 950 │
│ SELL               Rs.12,400 │        │     → pack now               │
│ · 2 orders to pack           │        ├──────────────────────────────┤
├──────────────────────────────┤        │ #11 Counter          Rs. 200 │
│ MONEY              Rs.18,450 │        ├──────────────────────────────┤
├──────────────────────────────┤        │ #10 WhatsApp        Rs.1,250 │
│ STOCK              Rs.45,000 │        ├──────────────────────────────┤
├──────────────────────────────┤        │ #9 Counter           Rs. 300 │
│ PEOPLE                    12 │        ├──────────────────────────────┤
├──────────────────────────────┤        │                              │
│ ▸ Sales report · 8am daily   │        │ [ New Sale ]                 │
├──────────────────────────────┤        └──────────────────────────────┘
│ [ New Sale ]           (Ask) │
└──────────────────────────────┘

SALE (POS)                              MONEY
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 9:41                       ● │        │ 9:41                       ● │
├──────────────────────────────┤        ├──────────────────────────────┤
│ ← New Sale            [done] │        │ ← Money                      │
├──────────────────────────────┤        ├──────────────────────────────┤
│ [ search products… ]         │        │ Cash               Rs. 8,200 │
├──────────────────────────────┤        ├──────────────────────────────┤
│ Saree silk   1          −  + │        │ Bank               Rs.10,250 │
├──────────────────────────────┤        ├──────────────────────────────┤
│ Blouse piece   2        −  + │        │ Today                        │
├──────────────────────────────┤        ├──────────────────────────────┤
│ CART (3)           Rs. 2,450 │        │ + Received           Rs. 500 │
├──────────────────────────────┤        ├──────────────────────────────┤
│ [cash] [upi] [card]          │        │ − Expense            Rs. 120 │
│                              │        ├──────────────────────────────┤
│                              │        │                              │
│                              │        │                              │
│ [ Complete Sale ]            │        │ [ Log Money ]                │
└──────────────────────────────┘        └──────────────────────────────┘

PEOPLE                                  ORDER DETAIL (tap a row)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 9:41                       ● │        │ 9:41                       ● │
├──────────────────────────────┤        ├──────────────────────────────┤
│ ← People          [+ Invite] │        │ ← Order #12                  │
├──────────────────────────────┤        ├──────────────────────────────┤
│ TEAM                         │        │ Sari order · to pack         │
│ Ravi · Owner                 │        ├──────────────────────────────┤
├──────────────────────────────┤        │ 1 Silk saree         Rs. 900 │
│ Meena · Cashier · Shift14    │        ├──────────────────────────────┤
├──────────────────────────────┤        │ Delivery              Rs. 50 │
│ CUSTOMERS · 12               │        ├──────────────────────────────┤
│ Priya · WhatsApp             │        │ TOTAL                Rs. 950 │
├──────────────────────────────┤        ├──────────────────────────────┤
│ Kumar · regular              │        │ Paid · UPI ✓                 │
│                              │        ├──────────────────────────────┤
│                              │        │                              │
│                              │        │                              │
│                              │        │ [ Mark packed ]              │
└──────────────────────────────┘        └──────────────────────────────┘

ASK (optional)                          RULES
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 9:41                       ● │        │ Home → card → list/detail    │
├──────────────────────────────┤        │          → action            │
│ ← Ask TAR                    │        ├──────────────────────────────┤
├──────────────────────────────┤        │ Sale + Chat own layout       │
│ TAR: how can I help?         │        ├──────────────────────────────┤
├──────────────────────────────┤        │ role filters read+action     │
│ you: who ordered Friday?     │        ├──────────────────────────────┤
│ TAR: Priya — 2 orders        │        ├──────────────────────────────┤
├──────────────────────────────┤        │ no screen per record type    │
│                              │        ├──────────────────────────────┤
│                              │        │ queued ↔ confirmed           │
│                              │        │ rejected: price/stock        │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│                              │        │                              │
│ [ message…           ↑ ]     │        │                              │
└──────────────────────────────┘        └──────────────────────────────┘
```

## Store commerce = first launch

```text
Create workspace → add products → share store / WhatsApp
                 → receive order or make sale → stock + money update

Home → New sale → choose products → review → payment → receipt
Home → Orders   → order detail → fulfill
Home → Stock    → products / adjust / low stock / purchases
Home → Store    → catalog / share link / WhatsApp
Home → Pending  → open work → take action
```

| Home card | Shows on card | Opens |
| --- | --- | --- |
| Sell | today's total + to-pack count | New sale / orders / history / invoices |
| Stock | low-stock count | Products / adjustments / purchases |
| Money | cash + bank | Receipts / payments / expenses |
| Reach | store link + new chats | Store / share / chat |
| People | team + customers | Members / customers / tasks |

Cards are per business type. Store launch = the five above. A taxi workspace
enables its own cards (e.g. Trips · Fares · Riders) later, on the same home.
Build a business type's cards only when it is prioritized—not before.

## Data = clear records

```text
SQLite = workspace + members + customers + business records + money
       + tasks + automations
Store  = products + orders + sales + sale lines + payments + stock movements
R2     = photos + documents + site releases
```

Use the tables, indexes and constraints the data needs. Prices, stock and
payment status stay in SQLite. A sale can contain many product lines.

| Rule | Meaning |
| --- | --- |
| Transaction | Sale + lines + stock commit together |
| Stable ID | Retry = same result, not a duplicate |
| Stock | Check availability + reservations; reject shortage |
| Money | Integer minor units + auditable accounts; balanced postings |
| Correction | Linked reversal; external payments use actual refund flow |
| Order | Ordered ≠ fulfilled ≠ sold ≠ paid |
| Totals | Indexed queries first; cache only when measured |
| Time | Store UTC; use workspace time zone for business days |

## Access + safety

```text
Member request → authenticate → current role + permission → gate → commit
Customer       → scoped public access → order
Payment event  → verify provider + event ID → update payment
```

- Check permissions on every read + action; handle revoked sessions.
- Sensitive actions + AI-suggested money / messages → human approval.
- Secure uploads + private files; keep secrets server-side.
- Preserve financial history + audit important changes.

## Live + offline

```text
Online    → action → gate → commit → role-filtered update
Offline   → local queue → reconnect → validate → confirmed / rejected
Reconnect → fetch current server state; socket ≠ truth
```

- Show **queued** separately from **confirmed**; retry with the same ID.
- Changed price, stock or permission → show conflict; user resolves it.
- Approvals + external payments need online confirmation.
- Notifications = alerts; server state = truth.
- External work = durable record + retries + idempotency + visible failure.

## Ask + automations

```text
Words / photo / import → Ask → TAR answers or acts

One-time:   Ask "who ordered Friday?"     → answer → done
            Ask "create PO for 50 units"   → confirm → done

Automation: Ask "every morning send sales report"
            → TAR plans: schedule 08:00 → send report
            → user confirms → saved as card on home
```

```text
Automation = one trigger + one action
  trigger: tap | schedule (HH:mm) | event (stock < N, order placed, ...)
  action:  one registered action with inputs

No multi-step flows. Chain = multiple automations on same trigger.
```

| Rule | Meaning |
| --- | --- |
| Model | LLM / Jev only where useful; validate output + measure cost |
| Execution | Confirmed automations run without a model; no unrestricted SQL |
| Safety | Money + customer actions always need human confirm |
| Reliability | Scheduled / event automations survive restarts and retries safely |

## Store + channels + network

| Feature | Plan |
| --- | --- |
| Store | Curated `*.tar.site` + catalog + orders; publish / rollback |
| WhatsApp | Shareable link first; opening WhatsApp ≠ message sent |
| Channels | Add reviewed official WhatsApp / Telegram adapters when needed |
| Payments | Verified provider events; workspace owns payment state |
| Custom site | Later: isolated sandbox for visuals; workspace owns business rules |
| Workspace ↔ workspace | Later: durable, idempotent delivery + explicit reconciliation / settlement |

## Delivery

```text
1. STORE LAUNCH
   workspace + roles + products + POS + orders + stock + money
   + curated store + WhatsApp sharing

2. RELIABLE DAILY USE
   offline + live updates + notifications + GST + imports
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
+ retries + stock conflicts + offline replay + payment events + actor restarts
+ delivery failures + backup restore.
