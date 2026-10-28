# TAR v2 — one page

A suggestion, not a replacement. Same laws, 14 tools, one surface.
It removes duplication and two tables. No new concept is added.

## Laws

1. One surface. Canvas is the app; Ask is fullscreen; every other
   screen is a card's detail. No tabs, no nav, no settings screen.
2. One action writes. One tool, one gate, one transaction:
   move + current + inbox (+ record when a fact changes). Gate is
   auto for none/data, ask when an input is missing, approve for
   money and customer.
3. One card = one number, one tap, chosen by role (money for the
   owner, counts for the member). At most one pending line. No
   chips, urls, status.
4. Inbox is a property of cards, never a place. NEXT is its top row;
   `!` marks urgent; the badge opens the flat view.
5. Posting is a balanced pair, stock never negative, every owner
   money tap undoes as the opposite move. The floor is code,
   never a model.
6. A phone is a window, not a copy: one slice in, one intent out.
   No database token, no sync, no mirror.
7. No model on run. Integration, import, skill and publish are
   built and confirmed once, then run free.
8. Member belongs to a workspace; customer only sees a storefront.
   Many workspaces are a list, never a merge. Personal is a
   workspace of one: its slice is the whole DB, and it graduates
   in place.

## Data

```
Memory = skill. describe once -> literal -> shape -> prose -> confirmed.
         free forever. one embedding column, only if misses climb.
```

Eight tables, two homes:

| home | table | columns | one job |
| :--- | :--- | :--- | :--- |
| D1 | user | id, email, name | who exists |
| D1 | workspace | id, name, slug, mode, db, host, state | one boundary |
| D1 | member | workspace, user, email, role, state | who belongs where |
| Turso | record | id, type, data, owner, archived, created | the fact now, <2KB |
| Turso | move | id, kind, record, run, key, amount, why, source, created | every change |
| Turso | current | kind, key, data | the number now, rebuildable |
| Turso | skill | id, shape, trigger, steps, score, confirmed | memory of flow |
| Turso | inbox | id, member, move, tool, reach, due, assigned, status | each member's rows |

```
invite     = member.state invited. a join is one tap.
run        = moves sharing a run; unique(key) dedupes. a log, never a resume.
version    = move is the version; no column.
one write  = one transaction. 90 days hot -> monthly close -> archive.
             current = close + moves after. one ceiling covers writes and models.
bytes      = R2. numbers, states, links = DB. price, stock, totals and
             payment state never live only in R2.
```

One schema, two modes. No migration, no second schema.

## Tools — 14, one registry

| # | Tool | Card | Reach | One tap |
| :-: | :--- | :--- | :--- | :--- |
| 1 | pos | Counter Sales | money | New Sale |
| 2 | order | Orders and Dispatch | customer | Open Queue |
| 3 | invoice | Billing and GST | money | Issue Bill |
| 4 | payment | Payments and UPI | money | Record Receipt |
| 5 | register | Cash Drawer | money | Count Cash |
| 6 | catalog | Products and Prices | data | Add Item |
| 7 | stock | Inventory and Warehouse | data | Adjust Stock |
| 8 | purchase | Supplier POs and GRN | money | New PO |
| 9 | expense | Daily Expenses | money | Log Expense |
| 10 | contact | Customers and Leads | customer | Add Contact |
| 11 | member | Team and Shifts | data | Manage Members |
| 12 | site | Online Storefront | customer | View Store |
| 13 | task | Manual Tasks | none | Mark Done |
| 14 | channel | Messages | customer | Open Chat |

A tool is a registry row: `{shape, fields, reach, nature, number}`.
Reach sets the gate; nature sets the recipe; shape sets the screen.
Nature (product/service/commodity), channel adapters and stage tags
are fields, not tools or tables. No core flow (sell, buy, close) =
deferred.

## Shapes — four, not fourteen

A new tool is a registry entry. A new screen is a new shape, and
only that. The branch lives in data, never code.

```
list    queue, bills, receipts, cash, items, stock, POs, expenses,
        contacts, members, tasks. rows + number + one tap.
sale    pos. invoice is sale in gst mode. cart + tender.
sheet   one form, many configs: receipt, cash, item, stock, po,
        expense, contact. fields from the registry.
chat    channel. the one shape earned, never assumed.
site    no screen. view store is a url.
detail  any row tap. fields + status. a view, not a shape.
```

Six screens, one sheet, one registry:

```
src/
  screens/    Canvas  Ask  List  Sale  Chat  Detail
  components/ ActionSheet  Card
  tools/      registry.ts
```

## Surface

Card core = the 14 tools, the only menu. Birth deals the recipe's
cards; (+ Add a Card) browses the rest, zero model calls, one
record per card.

```
+----------------------------------+
| (3) Aambal Tea Stall          o  |
| Owner                            |
+----------------------------------+
| ! NEXT  Cash drawer out Rs. 350  |
|                         [ Audit ]|
+----------------------------------+
| COUNTER SALES                    |
| Rs. 18,450 today                 |
|                      [ New Sale ]|
+----------------------------------+
| ORDERS                           |
| 3 to pack                        |
|                    [ Open Queue ]|
+----------------------------------+
|                 [ + Add a Card ] |
|                              (+) |
+----------------------------------+
```

Same screen for every member: grants change the stack, not the
layout. Header: circle badge = inbox, plain avatar = you, a
hairline, type one step smaller and muted. Cards on paper,
whitespace only. Floating (+) = Ask.

Ask is fullscreen and yours alone: it sees what your grants allow.
words -> plan -> confirm -> skill -> card. Registered actions only.
Money or customer always asks first. Your own card takes one
confirm; another member's needs owner or admin.

## Onboarding — one surface, one confirm

```
CREATE  a sentence -> Jev names nature and risk -> code deals the
        recipe's cards -> one confirm -> Canvas with a NEXT.
JOIN    an invite card -> one tap -> a member row. grants pick
        the stack. zero model calls.
GROW    a fact (hire) -> mode change -> confirm. no migration,
        no model. never silent.
SPLIT   LLM proposes, Jev types, the action writes behind a gate.
        no model after birth. Jev speaks three times only: birth
        (nature + risk), import (rows), hire (role).
BIRTH   one idempotent control action: D1 rows + blank Turso +
        empty R2. an abandoned draft leaves nothing. control
        actions use the same registry and gate; 14 tools stay 14.
MANAGE  members on the member card; name, mode, url on Ask.
        archive is a state, records are never deleted, workspaces
        never merge. archive and transfer ask twice.
```

## Site, network, integration

```
Site          one tool, two modes, one door. curated now, sandbox
              later. one worker for *.tar.site; subdomain -> release
              in R2. publish = an immutable release; rollback repoints.
              the LLM writes looks, never price, stock, tax or payment.
Integration   adapter -> registered action at build time. no model on run.
Network       phase 2. an agent orders into another workspace as
              action + gate; each side keeps its records; routing in
              control. settlement is the one new design.
```

## Device and freshness

```
login     one TAR session. the only credential on the phone.
read      GET /slice: workspaces, counts, cards, NEXT. kilobytes,
          one call. a detail is one more read, on tap.
write     tap -> queue (key) -> action -> gate. the response is the
          new slice. the phone sends intent, never data.
offline   cached slice for reads; ordered queue for writes. the
          badge tells server truth.
fresh     open app: 20s if-none-match on the last move. own tap:
          fresh slice. closed phone: OS push. no websocket in v1;
          the poll is the floor.
plug      DB behind the API: Turso now, SQLite files later. laws
          unchanged. files copy.
```

## What moved

| v1 | now |
| :--- | :--- |
| invite table | member.state = invited |
| run table | move.run + unique key (nothing resumes anyway) |
| record.version | move is the version |
| GET /me + slice | one GET /slice |
| monthly hash-sealed close | close row (seal later if needed) |
| "four shapes" + a fifth "fourth shape" | 4 shapes; detail is a view |
| 2 canvases, Ask sketch, 8 onboarding screens | one canvas + prose |
| device, realtime, cost guard paragraphs | 6 lines |
| nature, channel, stage concept entries | registry fields |
