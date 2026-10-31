# TAR - One Live Room

## Concept

```
TAR          = one live room + 3 tables + 5 cards + skills

Room         = one workspace = one actor = one SQLite.
               every member connects to the same instance.
               a tap commits in 0.7 ms; everyone sees it in under 1 ms.
User         = starts in a personal room. one tap switches rooms.
               no auto-switch, no merged view, no cross-room joins.
Member       = owner, admin, staff. the room is members only.
Customer     = storefront or channel only. never in the room.

Truth        = a room holds exactly three things:
               item   what exists (catalog, contacts, members, config)
               move   what happened or waits to (sale, bill, receipt,
                      count, adjust, PO, expense, task, approval)
               skill  how it repeats

Pending      = a move with state pending. not a place.
               it is the line on its card, and a row in the badge.
               a tap sets it done; it leaves every screen at once.
Done         = a move with state done. the ledger and the numbers.
               a number is a sum over done moves, held in the actor's RAM.

Card         = title, one number, at most one pending line, one tap.
               the number is money on a card that moves money and a
               count elsewhere; the role picks which. no chips,
               no second number, no url, no status.
               everything else is a detail screen.
Core         = five cards, one per domain. the only menu.
               a room is dealt 2 to 5 at birth by its nature.
               a confirmed tap skill is pinned as one more card.
               a canvas holds at most six.
Surface      = one screen, no tabs. Canvas is the app.
               avatar = you, and the room switch.
               circle badge = every pending move, flat.
               floating (+) = Ask, fullscreen.
NEXT         = gone. every card carries its own pending line and
               floats to the top while it has one. no banner, no strip.
```

## Cards (5)

| # | Card | owner number | member number | one tap | holds |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | Sell | Rs. revenue today | to pack | New Sale | pos, gst bill, order queue |
| 2 | Money | Rs. net cash + bank | receipts today | Log Money | receipts, upi, drawer, expenses, payouts |
| 3 | Stock | Rs. inventory value | low items | Adjust | catalog, stock, POs, GRN |
| 4 | Reach | leads this week | unread | Open Chat | contacts, whatsapp, telegram, tar.site |
| 5 | Work | pending tasks | my tasks today | New Task | team, roles, shifts, tasks |

```
the 14 old tools are kinds under the five:
  sell    pos, invoice, order
  money   payment, register, expense, purchase payment
  stock   catalog, stock, purchase
  reach   contact, channel, site
  work    member, task

a kind is a row in the registry. a card is a lens over kinds.
a solo shop starts with sell, money, stock. a full one uses all five.
```

## Shapes - four, and one read view

```
list      one route: queue, bills, receipts, cash, items, stock,
          POs, expenses, contacts, members, tasks.
sale      one route: pos. a gst bill is sale in tax mode.
chat      one route: channel.
sheet     one form, many configs: receipt, cash, item, stock,
          po, expense, contact.
detail    a row tap: one move or one item. read + one tap.
          a view, not a shape.

a new kind is an entry in the registry, never a screen.
a new screen is earned by a new shape, and only that.
```

## Gate - the code floor, no model

```
idempotent  move.id is the client key. the same key never lands twice.
durable     durable async is a move row, never a queue message.
            a queue drops a message when it is received and never
            retries it. a move retries by its own id.
shutdown    in-flight actions are not awaited on sleep. push and
            adapter work rides waitUntil. an action has 60 s.
posting     a money move is two rows sharing one pair id and
            naming their account. both pending, or both done.
            a pair that does not sum to zero writes nothing.
stock       available = onhand - reserved, never below zero.
            a crossing write is refused and posts one urgent
            pending move on Stock: ! shortage, audit.
reach       a human writes inside their grant: commits at once.
            above the grant, they wait like a skill: one pending
            move on the owner's card. a skill that moves money or
            messages a customer always waits. the gate is on the
            writer, never on the person.
customer    a storefront or channel writes orders, never money.
            an order lands pending to pack; selling needs no
            approval. a capture from a payment adapter is done and
            undoable; money out of a skill waits.
undo        every owner money tap has one-tap undo. undo writes
            the opposite pair, with reverses = the pair it undoes.
            a pair already reversed is never reversed again.
```

## Data - 3 tables

| table | columns | job |
| :--- | :--- | :--- |
| item | id, type, data, version, archived | nouns. data under 2KB or an R2 url |
| move | id, kind, tool, item, qty, amount, account, pair, state, reverses, by, at | verbs + queue + ledger |
| skill | id, name, trigger, recipe, params, role, next_run | how it repeats |

```
no inbox     pending is a state.
no current   sums over done, in RAM, rebuildable.
no run       the move id is the run key.
no chat      Ask turns live in the actor, as items.

Close        no pruning. Rivet keeps hot data on local disk and
             offloads the rest to S3 by itself. old rows stay
             readable, nothing is deleted, no retention rule.
             keep one thing: a monthly close row. a card number is
             close + moves after it, never a full-ledger scan.
Bytes        R2. media, papers, releases.
             a phone uploads straight to R2 and sends the url.
             never only in R2: price, stock, totals, payment state.
```

## Ask & Skills - describe once, run free

```
Ask          = one conversation. words, photos, exports.
               LLM drafts -> Jev types -> one confirm -> a skill,
               a record, or a card. money or customers wait for the owner.
               a draft slower than 60 s is a background run, pushed
               when ready.
Skill        = trigger + recipe + params. confirmed once, runs free.
               tap    pinned as a card
               event  right after a matching move, same transaction
               time   an actor schedule. durable, wakes a sleeping
                      room, utc by default, so the zone is a param.
               msg    a channel adapter
               recipe code shipped in the registry. the model picks
               a recipe and fills params. it never writes SQL or code.
Memory       = L0 literal -> L1 shape -> L2 prose -> confirmed skill.
               a miss climbs one step. nothing runs unconfirmed.
```

## The 3 brains

```
words / photos / exports -> LLM drafts -> JEV types -> one confirm -> room

LLM     proposes only. never writes.
JEV     four verdicts, in parallel, no prose:
        nature  which 2 to 5 cards | role | sanity of rows | risk
GATE    the code floor above.

no model on run. models speak at birth, import, hire, site and ask.
Integration = adapter -> recipe -> one of the five cards.
              built and reviewed at build time, never found at runtime.
```

## Canvas - one screen, every member (concept)

```
   OWNER - money, stock, store         MEMBER - own work, own shift
 +----------------------------------+  +----------------------------------+
 | (3) Aambal Neyvagam          (o) |  | (2) Aambal Neyvagam          (o) |
 | Owner                            |  | Cashier - Shift 14               |
 +----------------------------------+  +----------------------------------+
 | ! MONEY              Rs. 18,450  |  | SELL                  9 bills    |
 | Cash drawer out Rs. 350  [Audit] |  | 2 orders to pack       [ Pack ]  |
 +----------------------------------+  +----------------------------------+
 | SELL                 Rs. 12,200  |  | WORK                   2 tasks   |
 | 2 orders to pack       [ Pack ]  |  | my tasks today      [ New Task ] |
 +----------------------------------+  +----------------------------------+
 | STOCK                Rs. 45,000  |  | STOCK                  4 low     |
 | 4 low items          [ Adjust ]  |  | 4 low items          [ Adjust ]  |
 +----------------------------------+  +----------------------------------+
 | REACH             142 visits     |  | REACH                  3 unread  |
 |                     [ Open Chat ]|  |                      [ Open Chat ]|
 +----------------------------------+  +----------------------------------+
 | WORK                 3 pending   |  |                                  |
 |                     [ New Task ] |  |                                  |
 +----------------------------------+  +----------------------------------+
 |                              (+) |  |                              (+) |
 +----------------------------------+  +----------------------------------+
```

```
a card with ! floats to the top. the rest keep their order.
the badge counts every pending move. tapping it opens one flat list.
```

## Birth, join, grow

```
CREATE   one sentence -> nature -> cards 2..5 -> [ confirm ]
         -> actor wakes, 3 tables, first pending move, Canvas ready.
JOIN     one invite code -> one role -> [ join ] -> a member item and
         a pending link move. the link retries into the personal room
         until done. the room is authority; the link is a cache.
GROW     an import, or a new line of work -> [ confirm ].
         personal -> work is a mode change, not a migration.

the confirm is always one. a draft never lands until it is tapped.
a failed or abandoned birth leaves nothing.
```

## Site

```
one card (Reach), two modes, one url: *.tar.site

curated  jev recipe -> a release in R2.
custom   an ephemeral sandbox actor writes astro. visuals only.
         price, tax, stock and checkout call the room's gate.
release  immutable. publish and rollback repoint a row.
         the room owns the url. the mode can change, the url does not.
```

## Network - phase 2

```
room -> room over actor rpc. a buyer's order enters the seller's gate
as one pending move on their Sell card. each room keeps its own SQLite.
routing lives in the order, never a join. an rpc is not durable,
so a failed order retries by its move id. settlement across rooms
is the one new design.
```

## Device - a window, never a copy

```
socket   one connection to the active room, live while it is awake.
         a room sleeps after 30 s idle and drops every socket.
slice    pending rows + card numbers + badge, role-filtered, ~200B.
         pushed on every commit.
open     reconnect wakes the room and returns the slice. the slice,
         not the socket, is the truth.
offline  the last slice on disk is fine. taps wait in a queue with
         move ids and replay in order. a queued tap is sent, not
         done; the badge shows server truth, never the queue.
         a tap carries intent and inputs, never price, stock or
         totals; the room re-reads them at commit. a tap the gate
         would pend lands pending, and only the owner can approve
         it, only online.
closed   FCM / APNs, from the actor. a device item holds the token.
grant    the server grants the slice. the phone never picks its own.
```

## Deploy - Rivet 3.0 (preview, 2026-10-26)

```
runtime  one Rivet binary. one container is enough.
         actors sleep and wake in 6.9 ms, write in 0.69 ms,
         read in 0.20 ms (WarpDrive: 3 AZ, S3 behind).
         three nodes across AZs is HA, not a minimum. or Rivet Cloud.
         Apache 2.0.
auth     getParams sends the google token on every connect.
         onBeforeConnect verifies it and checks the member item;
         throwing rejects the socket. that hook is the acl.
         no control database, no gateway on the data path.
         keys are arrays, ["room", slug], never a joined string.
         the personal room keeps a link; the room is authority.
limits   as of 3.0 preview: no built-in acls (onBeforeConnect is
         ours), no multi-region, no serverless. cost is nodes + S3,
         not per room.

backend/  workspace.ts   one actor: 3 tables, gate, skills, alarms, slice
          sandbox.ts     site mode 2
          registry.ts    5 cards, 14 kinds, recipes, adapters
src/      Canvas, Ask, CardList, Sale, Chat, RecordDetail
          ActionSheet, Card
```
