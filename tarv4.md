# TAR v4 — One Canvas OS

> One sentence: **Merchant describes business once. System puts the right cards on their Canvas. Every card is a saved read + one tap. Every tap writes one record. No model at render or run.**

```
WORDS or TAP  ->  PLAN (LLM sketch + JEV pick + CODE wire)  ->  CARD  ->  GATE  ->  ONE RECORD  ->  EVERY CARD SYNC
```

| This file | Why |
| :--- | :--- |
| canvas.md | what merchant sees |
| flows.md | how work runs |
| parai.md | how store looks |
| **tarv4.md** | **one OS that does all three with 2 model calls at setup, 0 after** |

---

## 0. TL;DR

| Question | v4 Answer |
| :--- | :--- |
| What is the product | A Canvas of cards. |
| What is a card | Saved read + one tap. 2 shapes, 5 presets. |
| What is a flow | Ordered CRUD steps on existing tools. |
| What is a site | One more card. Design + recipes + gate. |
| Who decides | JEV (choices). LLM (words). Code (truth). |
| When do models run | Once at plan. Never at render/run. |
| How many calls to go live | 2 batches (business + look). Then 0. |
| What does merchant do | Describe once, confirm once, tap. |

```
v4 LAWS
  1 Every event writes balanced debit/credit
  2 Stock never negative (available = on hand - reserved)
  3 Nothing erased — archive only, every change logs who/when/what
  4 One records table — new trade = new record type, never new table
  5 Money or customer -> one confirm
  6 Every owner tap has one-tap undo
```

---

## 1. The Idea

```
 BEFORE                              AFTER

 +------------------------+            +------------------------+
 | [pos] [order] [item]   |            | COUNTER SALES  SHIFT 14 |
 | [cash][store] [chat]   |    ->      | Today 18,450  UPI 14,100 |
 | [flow][stock] [more]   |            | 14 bills  [ New Sale ]   |
 +------------------------+            +------------------------+
 a drawer of 18 tool icons            your Canvas — only cards
 same for everyone                    allowed for you, useful now
 need training                        zero training, one tap
```

```
 CARD  = saved read + one tap
 FLOW  = ordered steps (each step = one existing tool)
 SITE  = card + design + recipes + publish gate
 TAP   -> CHECK -> ONE RECORD -> EVENT -> INBOX -> EVERY CANVAS
```

---

## 2. Vocabulary — 7 words only

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Workspace | Business boundary: members, cards, site, one DB | Aambal Neyvagam, Salem |
| Canvas | Home stack — only cards allowed for you and useful now | Cashier 4 cards, Owner 6 |
| Card | Saved read + one tap | Cash Drawer: Rs 4,350 + [Count Cash] |
| Flow | Ordered resumable steps, max 12 | Evening Closing 4 steps |
| Step | One existing tool call (CRUD) | count cash drawer |
| Record | Typed row in the one records table | item, stock, order, posting |
| Inbox | Personal to-act feed, mandatory per member | 2 waiting, 1 overdue |

No other noun needed. `Trigger`, `Gate`, `Modifier` live inside Flow only.

---

## 3. Architecture — Build vs Run

```
BUILD TIME (CI, before deploy)              RUN TIME (Worker + Phone)
─────────────────────────                    ─────────────────────────
designmds/*.md (100 curated)                MERCHANT INPUT
  | parse + validate + tag                     | description, city,
  v                                            | hours, items, photos
tokens/<id>.json ──┐                         v
index.json (30KB) ──┼── bundled with Worker   JEV #1 : business
recipes/*/*.json ───┘      (no fetch,          -> models, industry, cards, flows
                           no cache miss)      |
                                               v  CODE shortlists (max 6)
                                            JEV #2 : look
                                              -> design, recipe per type,
                                                 spotlight/story/trust
                                               |
                                               v
                                            CODE assembles Canvas + Site draft
                                               |
                                          gate? ── fail -> draft + missing list
                                               └── pass -> ready to publish (merchant taps)

hashState(facts + photos) changes -> regenerate draft. Publish is always a tap.
tarapp calls API for design list (name + swatches). Never reads .md.
```

| Store | What | Size (100) | Who reads |
| :--- | :--- | :--- | :--- |
| `designmds/*.md` | source | ~2.5 MB | build only |
| `tokens/<id>.json` | parsed tokens | ~1 MB | Worker bundled |
| `index.json` | id, tone, industry, model, swatches | ~30 KB | Worker + API |
| `recipes/<type>/<id>.json` | layout + slots + settings schema | ~200 KB | Worker |

Move to R2 only when bundled tokens exceed ~5 MB or need deploy-free update.

---

## 4. One Kernel

```
Everything is CRUD on one records table. Code owns numbers, stock, money.

 C  create  -> one new record
 R  read    -> count, sum, list, report (projections are read-only)
 U  update  -> one new version of a record
 D  delete  -> archive (never erase)
```

| Record type | Writes | Also writes |
| :--- | :--- | :--- |
| sale | order + invoice + payment | posting (debit cash / credit revenue) + stock |
| expense | expense | posting |
| stock move | inventory | — |
| member | member | — |
| flow run | run + step pointer | — |

```
Projections read records.
  P&L, GST, forecast, stock on hand — all computed by code from records.
  LLM never computes. JEV never computes.
```

---

## 5. Cards — One Anatomy

```
+----------------------------------------+
| [icon] Counter Sales           [SHIFT]  |
| Today Rs 18,450  UPI 14,100             |
| 14 bills, drawer cash Rs 4,350         |
| [ New Counter Sale ]                    |
+----------------------------------------+
 Tap title  -> opens detail (list/search/detail)
 Tap button -> commits once (gate -> one record)
 Other actions live in detail
```

| Preset | Shape | Opens | Example |
| :--- | :--- | :--- | :--- |
| tool | action | list, search, detail | Products, Stock |
| flow | flow | checklist run | Evening Closing |
| site | action | store preview + edit | Online Store |
| channel | action/read | feed or chat | WhatsApp, Telegram |
| human | action | task list | Manual Tasks |

**18 tool cards grouped in 5 surfaces:**

| Surface | Holds |
| :--- | :--- |
| Canvas | Home stack — allowed + useful cards |
| Flows | Active runs + available flows |
| Site | Storefront preview, edit, publish |
| You | Profile, settings, workspaces |
| Inbox | Personal to-act feed (mandatory) |

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

---

## 6. Flows — One Grammar, One Executor

```
PLAN
  trigger  tap | schedule | event
  steps    [ step, ... ]                  max 12
  card     title + 0-2 metrics + 1 tap

STEP
  crud     C | R | U | D
  tool     one registered action only
  input    known at plan time OR ask at run
  gate     auto | ask | approve
  mod      none | retry | repeat | undo | match
```

### 6.1 Three Gates, Four Modifiers

| Gate | Who acts | When |
| :--- | :--- | :--- |
| auto | code | inputs known AND reach in {none, data} |
| ask | person | input missing OR physical step |
| approve | owner/admin | money, customer, or over limit |

| Modifier | Meaning | Scope |
| :--- | :--- | :--- |
| retry | run once more on failure | step |
| repeat | again until state changes, or once per row | flow/row |
| undo | opposite posting | step |
| match | read two sources, update the match | plan |

```
JEV picks tool + gate + modifier.
CODE checks tool supports them. If not, falls back to derived gate/mod.
CODE upgrades gate on safety floor: auto + money -> approve.

7 old shapes are just combinations:
  straight  = auto              loop       = auto + repeat
  human     = ask               batch      = auto + repeat each
  approval  = approve           reconcile  = auto + match
  retry     = auto/ask + retry  reverse    = approve + undo
```

### 6.2 Runtime Is Deterministic

```
TAP / SCHEDULE / EVENT
        |
        v
GATE    token, grant, version, idempotency
        |
        v
CRUD    one record row (or one balanced set)
        |
        v
EVENT -> INBOX (role-filtered) -> EVERY CANVAS SYNCS
```

| Rule | Meaning |
| :--- | :--- |
| No model on render | cards read records/metrics |
| No model on run | steps are deterministic |
| One write | one step commits alone |
| Retry safe | same run+step never doubles |
| Nothing erased | archive only |
| Reversible | one-tap undo |

---

## 7. Site — Design + Recipe + Gate

### 7.1 Layout Grammar (code, once)

| Primitive | Meaning |
| :--- | :--- |
| stack | vertical blocks, token spacing |
| row | horizontal blocks, wraps at breakpoint |
| grid | n columns, responsive |
| split | two regions, ratio from token |
| overlay | media + content + scrim |
| rail | horizontal scroll + snap |
| disclosure | expandable list |

### 7.2 Recipe (data, one file per layout)

```json
{
  "id": "split", "type": "hero",
  "models": ["products","food","booking","quote","digital","bulk"],
  "needs": { "media": "optional" },
  "layout": { "kind": "split", "ratio": "50/50", "collapse": "stack" },
  "slots": { "headline": { "source": "brief.headline", "max": 80 },
             "body": { "source": "brief.summary", "max": 240 },
             "media": { "source": "photos[0]", "optional": true },
             "cta": { "source": "route.primary" } },
  "settings": { "reverse": "boolean", "ctaLabel": "text" }
}
```
`settings` is the merchant-editable schema. Editor builds controls from it.

| Type | Folder | Used by |
| :--- | :--- | :--- |
| header | `header/` | all |
| announcement | `announcement/` | when notice exists |
| hero | `hero/` | all |
| spotlight/story/trust | `spotlight/ story/ trust/` | JEV yes/no |
| catalog / menu / booking | `catalog/ menu/ booking/` | by model |
| faq / policy / location | `faq/ policy/ location/` | by model |
| contact / footer | `contact/ footer/` | all |

### 7.3 Commerce Models — One Gate Table

| Model | Money moves when | Required sections | Gate must have |
| :--- | :--- | :--- | :--- |
| products | buys item | header, hero, catalog, policy, contact, footer | 1 item, contact |
| food | orders meal | header, hero, menu, location, contact, footer | 1 menu item, contact, hours |
| booking | books time | header, hero, booking, faq, contact, footer | 1 bookable service, contact |
| quote | asks price | header, hero, booking(enquiry), faq, contact, footer | contact, enquiry route |
| digital | downloads/subscribes | header, hero, catalog, policy, faq, contact, footer | 1 priced item, contact |
| bulk | buys volume | header, hero, catalog, faq, contact, footer | 1 item, enquiry route, min order |

Union of models = required sections. Optional sections from facts or JEV yes/no.
Empty model set rejected. JEV confidence < 0.60 -> ask merchant.

### 7.4 How Site Assembles

```
Section order (code): header, announcement?, lead, hero, ..., trust?, faq?, policy?, location?, contact, footer
Lead moves one optional section up. Everything else fixed.
Gate fail -> draft saved + "missing list" (e.g. "add 1 bookable service")
Gate pass -> ready to publish (merchant taps once)
Overrides (design, recipe, settings, text, section on/off) beat JEV and survive regeneration.
```

---

## 8. Jev + LLM — Perfect Split, Minimal Calls

### 8.1 Who Owns What

| Layer | Owns | Never does |
| :--- | :--- | :--- |
| JEV | choices (pick from closed list) | prose, numbers, SQL, grants |
| LLM | language (extract, name, explain, rewrite) | pick ids, compute totals, commit |
| Code | truth (counts, stock, money, gate, commit) | — |

```
JEV reads plain words, returns typed choices.
CODE enforces the same check on every tap.
CACHE key = hash(state) + model id -> same state = 0 calls.
```

### 8.2 The Two Batches Only

```
SETUP (once)

  Merchant: "Weave silk sarees, UPI + cash counter, ship nationwide, need store"
       |
  JEV #1 — business (1 batch)          Input: description, city, hours
       |  -> { models, industry, capabilities, confidence }
       v
  CODE — shortlist (0 model)            Filter index by model+industry, rank tone/density -> max 6
       |
  JEV #2 — look (1 batch)              Input: profile, facts, shortlists, avoid[]
       |  -> { design, recipe per type, lead, spotlight?, story?, trust? }
       v
  CODE — assemble draft + gate

LIFETIME

  similar intent ("send stock report at 8am" vs "sales report at 10am") -> memory hit, 0 LLM, 1 JEV choice
  exact repeat ("run daily report now")                                  -> 0 LLM, 0 JEV, code instantiates
  every render and every step run                                        -> 0 LLM, 0 JEV
```

### 8.3 Inside One Flow Plan

```
WORDS  ->  LLM sketch (goal, trigger phrase, step phrases, slots)
            |
            v
       JEV batch: trigger + step_i {tool, gate, mod, needed?, complete?}
            |
            v
       CODE wire + validate + derive gate + fallback + card generation
            |
            v
       OWNER confirm once -> MEMORY (confirmed plan reused)
            |
            v
       RUN forever with 0 calls
```

| Signal | Use |
| :--- | :--- |
| Choice argmax | pick tool/gate/mod/trigger |
| Top-2 fallback | top invalid or unsafe -> second |
| Noul | step needed?, plan complete?, approval needed? |
| Score | best of 2 valid plans, only on tie |
| Plan confidence | min(step confidences), free |

Rejected: self-consistency N times, beam search (cost/complexity).

| Risk | Auto only if | Else |
| :--- | :--- | :--- |
| none/data | confidence >= 0.60 | ask |
| customer | confidence >= 0.80 | confirm |
| money | confidence >= 0.85 | confirm + owner |

### 8.4 Cost Table — Why This Is Zero-Waste

| Moment | LLM | JEV | Code |
| :--- | :---: | :---: | :--- |
| New intent (first time) | 1 sketch | 1 batch | compile |
| Similar to memory | 0 | 1 choice (fill slots) | instantiate |
| Exact repeat | 0 | 0 | instantiate |
| Every run / every render | 0 | 0 | execute/read |
| Workspace setup total | 1 | 2 | — |
| Daily operation (100 runs) | 0 | 0 | — |

```
LLM generates candidates. JEV generates probabilities over closed choices.
CODE composes the highest valid plan. MEMORY removes calls next time.
```

---

## 9. Access — Plain English, No Dropdown

```
workspace enabled
  AND JEV grants for this member
  AND now
  = visible cards
```

```
JEV reads: "cashier, packs orders, no price edits"
  -> ALLOW  Counter Sales, Cash Drawer, Order Fulfilment, Inbox
  -> HIDE   Products and Prices, Store Studio, Team, Revenue
Roles never picked from dropdown. Grants derived, not assigned.
```

| Card or action | Owner | Admin | Member (Cashier) | Guest |
| :--- | :---: | :---: | :---: | :---: |
| Counter Sales (pos) | Full | Full | Execute only | Denied |
| Cash Drawer (register) | Full | Full | Shift only | Denied |
| Revenue Summary | Full | Full | Hidden | Denied |
| Order Packing (order) | Full | Full | Full | Denied |
| Pricing and Catalog (item) | Full | Full | View only | Denied |
| Storefront Studio (site) | Full | Full | View only | Public view |
| Team and Grants (members) | Full | Full | Hidden | Denied |

Full = see + act. Execute only = act, no settings. View only = see only.

Person may belong to several workspaces; each isolated.

---

## 10. Runtime Loop — One Tap, One Truth

```
TAP
 |
 v
CHECK  token, grants, version, idempotency          <- code gate
 |
 v
ONE RECORD ROW (+ balanced postings)                 <- one commit
 |
 v
EVENT --> INBOX (role-filtered) --> EVERY CANVAS SYNCS
```

| Situation | Behavior |
| :--- | :--- |
| Reads | pending orders, cash on hand, active runs |
| Offline | "Saved on phone, will sync when online" |
| Delete | archive, never erase |
| Undo | one tap reverses same record |

Boundary:

| Allowed | Not allowed |
| :--- | :--- |
| Compose any existing tool | Invent a tool or screen |
| Read any allowed record | Model-written SQL |
| Create, update, archive | Hard delete |
| Trigger by tap, schedule, event | Auto step that moves money or messages customer |
| Owner confirms once | Silent creation from chat |

---

## 11. Inbox — Event Becomes One-Tap Card

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

Inbox is mandatory for every member. One event = one card for the right person.

---

## 12. End-to-End Traces — 3 flows that prove the grammar

### 12.1 Daily Sales Report (straight)

| # | CRUD | Step | Gate | Mod |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Read | sales summary, yesterday | auto | — |
| 2 | Create | deliver to owner | auto | — |

```
User: "every day at 10am send me sales report"
  -> LLM extracts {trigger=schedule 10:00, target=sales}
  -> JEV picks {schedule, sales summary, delivery, auto, auto}
  -> Card: Daily Sales Report | Last today 10:00 | Next tomorrow 10:00 | [Run now]
  -> 10:00 -> read sales -> create delivery -> card shows last run
  -> After: 0 calls per run. "stock report at 8am" reuses plan, 1 JEV choice.
```

### 12.2 Custom Weave Order (handloom, 7 steps, human + approval)

| # | CRUD | Step | Gate | Mod |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Create | advance task | auto | — |
| 2 | Create | start weaving run | ask | — |
| 3 | Update | finish weaving, add stock | ask | — |
| 4 | Update | fulfil order | ask | — |
| 5 | Create | issue invoice | approve | — |
| 6 | Create | record balance | approve | — |
| 7 | Create | dispatch + tracking | ask | — |

```
Order created (trigger=event)
  -> step1 auto: advance task
  -> step2 asks: [Perform Step 2] -> member taps -> stock reserved
  -> ... -> step5 approve: owner confirms -> invoice posted (balanced)
  -> done -> card turns green -> event -> packer inbox
```

### 12.3 Site Publish (parai path, same kernel)

```
Input: "Handloom silk sarees, Kanchipuram; 42 items w/ photos; Silk Mark; Pongal sale"
JEV #1: models {products, booking}, industry apparel
  Shortlist: design [luxury, warm], hero [split, commerce], catalog [grid, rail]
JEV #2: { design=luxury 0.79, hero=commerce 0.81, catalog=grid 0.88,
          lead=spotlight 0.66, spotlight yes 0.88, trust yes 0.74, story no 0.42 }

Draft (code order):
  1 header     split            2 spotlight overlay "Pongal sale"  3 hero commerce
  4 catalog    grid 42 items    5 trust row "Silk Mark"            6 booking list -> MISSING
  7 policy     disclosure       8 faq disclosure                   9 contact whatsapp  10 footer

Gate: FAIL (booking) -> "add 1 bookable service with price". Draft saved, not published.
Merchant adds service -> hashState changes -> regenerate -> gate PASS -> [Publish] tap.
Products-only store publishes on first tap with no extra action.
```

---

## 13. Screens — What Merchant Actually Taps

```
SETUP                          DAILY (Owner)                    DAILY (Staff)
 New Workspace                  Aambal Neyvagam  Owner           Aambal  Kanimozhi
 Name [Aambal Neyvagam]         ! Cash drawer out Rs 350  >      NEXT  Pack parcel 2 items
 What do you sell?              NEXT  Dispatch #42  [Complete]   COUNTER REGISTER  [Quick Sale]
 [Generate Workspace]           COUNTER SALES      [New Sale]    ORDER PACKING     [Start Next]
        |                       ORDERS  Pending 3  [Open Queue]  INBOX 2 waiting   [Open Feed]
        v                       ONLINE STORE LIVE  [View Store]  SHIFT HANDOVER    [Start]
 Review 5 cards Jev selected    CLOSING ROUTINE 2/4 [Resume]     Ask TAR...  (+)  [Canvas] Flows Site You
 [Confirm and Open Canvas]      [+ Add a Card]  (+) [Canvas]...
        |
        v
 Add Member: phone + "cashier, packs orders, no price edits"
  -> JEV grants -> [Save and Send Invitation]
```

Card detail, flow detail, site detail, checkout all share one sheet pattern: title + metrics + one primary tap.

---

## 14. Business Manager — 14 Stages, 110 Capabilities

Stages are tags, not tables. Every capability is CRUD.

| Stage | Count | Lives in |
| :--- | :--- | :--- |
| Plan | 4 | projections, flows: forecast, S&OP, budgets, MRP |
| Source | 10 | purchase, contact: suppliers, RFQ, PO, GRN, landed cost, AP, returns |
| Stock | 10 | inventory: ledger, locations, counts, transfers, batches, packing |
| Make | 7 | recipe + flow: BOM, work orders, scheduling, scrap, QC, costing |
| Catalog | 4 | item: items, variants, units, channel price lists |
| Sell | 10 | pos, register, site: POS, register, print, offline, web store, offers |
| Order | 7 | order, invoice: quotes, orders, reservations, GST invoice, credit, returns |
| Money | 16 | postings: ledger, AP/AR, bank rec, expenses, GST, assets, P&L |
| People | 7 | members, flow: staff, roles, shifts, attendance, payroll |
| Serve | 9 | contact: leads, pipeline, tickets, bookings, time billing |
| Move | 5 | order: carriers, routes, POD, fleet, trips |
| Comply | 4 | records: QC, licenses, statutory dates, vault |
| Comms | 5 | inbox, whatsapp, telegram: tasks, flows, WhatsApp API, alerts |
| Manage | 12 | dashboards, approvals, branches, backups, settings |

| Screen | Opens from | Shows |
| :--- | :--- | :--- |
| Business Manager | Manage card or gear | 14 stages, live/off, Jev suggests 5 |
| Stage detail | a stage row | capabilities in that stage, Add Card |
| Financial Health | Money row | ledger, P&L, GST |

---

## 15. Why This Is Perfect for Merchant (and for us)

| Merchant fear | v4 answers |
| :--- | :--- |
| Too many apps, too many taps | One Canvas, one tap per job |
| Training staff | Plain English -> JEV grants, Inbox tells them what to do |
| Mistakes with money | One confirm, one undo, balanced books, stock never negative |
| Internet is patchy | Offline queue: "Saved on phone, will sync when online" |
| Online store is hard | Describe once -> draft -> one tap publish. No theme picker. |
| Cost of AI | 2 calls at setup, 0 per day. Cache by hash. Same state = 0 calls. |

| Builder fear | v4 answers |
| :--- | :--- |
| Model hallucinates | JEV only picks from registry. LLM never picks ids or computes. |
| Prompt bloat | Tool registry is alphabet. Confirmed plans are memory. No templates. |
| Runtime surprises | 0 model at render/run. Gate + version + idempotency on every tap. |
| Table explosion | One records table. New trade = new record type. |
| Design sprawl | 100 curated designs, build validates tokens/contrast/tags. R2 when >5 MB. |

---

## 16. Build Order — Keep Current Site Working Every Step

1. Add `models` to profile; validate JEV #1 against gate table.
2. Build: parse DESIGN*.md -> `tokens/` + `index.json` with validation (tokens, units, contrast, id, tags, license).
3. Switch `design.ts` to bundled library; migrate ids (`dark-luxury`->`luxury` etc).
4. Expose design list API for tarapp (name + swatches).
5. Define layout grammar + recipe schema + checks (snapshot at 390/768/1280).
6. Convert current renderers to recipes (header, hero, catalog, footer, contact).
7. Add missing recipes (spotlight, story, trust, booking, menu, faq, policy, location).
8. JEV #2 batch + shortlist (max 6) + override storage (settings schema).
9. Memory + hashState regeneration. Gate fail = draft + missing list.
10. One backend publish (`site.publishLatest`).
11. Expand to 100 designs via review list (bad design excluded, not build failed).
12. Remove `patterns/` legacy (`selector.ts`, `catalog.ts`, `renderSectionByPatternId`).
13. R2 move only when needed.

---

## 17. One-Page Summary

```
                          TAR v4 — ONE CANVAS OS

  MERCHANT DESCRIBES ONCE
         |
    +----+----+
    | JEV #1  |  business -> models, industry, cards, flows
    +----+----+
         |  CODE shortlists designs+recipes (max 6)
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
    EVERY RUN/RENDER -> 0 model calls

  LLM = words.  JEV = choices.  CODE = truth.
  Memory = confirmed plans.  Cache = hash(state).
  Offline = queued.  Delete = archived.  Mistake = undo.
```
