# Cards + Flows

| Part | Holds |
| :--- | :--- |
| A | Concept: CRUD, planner, card, flow, runtime |
| B | Use cases: daily report, handloom, other trades |

---

# PART A - CONCEPT

## A1. One screen

```
WORDS or TAP
     |
     v
PLAN    LLM sketches, JEV picks existing tools, CODE wires
     |
     v
CARD    saved read + one tap
     |
     v
GATE    checks grant, version, idempotency
     |
     v
RECORD  one row, then every card syncs
```

```
USER NEVER BUILDS A TOOL.
USER NEVER BUILDS A SCREEN.
USER SAYS THE OUTCOME OR TAPS THE CARD.
```

## A2. Everything is CRUD

```
C  create  -> one new record
R  read    -> count, sum, list, report
U  update  -> one new version of a record
D  delete  -> archive, never erase
```

| User says | CRUD | Existing tool |
| :--- | :--- | :--- |
| "add a product" | Create | item save |
| "change the price" | Update | price set |
| "show today's sales" | Read | sales summary |
| "send me a report" | Read + Create | summary + delivery |
| "remove this product" | Delete | archive item |
| "take order to dispatch" | Create + Update | order, stock, shipment |

```
EVERY FLOW = ORDERED CRUD STEPS
EVERY CARD = A SAVED READ + ONE WRITE
EVERY TRIGGER = WHEN TO RUN THE SAME STEPS
```

| If the tool exists | Then |
| :--- | :--- |
| yes | plan composes it, no code change |
| no | the plan cannot use it, owner sees one clear gap |

## A3. Primitives

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Card | Saved read + one tap | Daily Sales Report |
| Flow | Saved CRUD sequence | Custom Saree Order |
| Step | One existing tool call | Issue invoice |
| Run | One execution of a flow | Run 104, step 2 of 7 |
| Metric | A saved read | open orders, value |
| Trigger | When a flow starts | tap, schedule, event |
| Memory | A confirmed plan reused later | daily report pattern |

## A4. Plan once, run forever

```
WORDS
  |
  v
LLM    sketch: goal, trigger, step phrases, wanted output
  |
  v
JEV    one request: trigger, action per step, is step needed
  |
  v
CODE   wire output -> input, derive auto/human, validate
  |
  v
OWNER  confirm once
  |
  v
MEMORY save the plan
  |
  v
RUN    0 model calls, deterministic
```

| Layer | Owns | Never does |
| :--- | :--- | :--- |
| LLM | words, sketch, copy | ids, numbers, permissions |
| JEV | choices from existing tools | prose, SQL, grants |
| CODE | wiring, mode, numbers, commit | guessing intent |
| OWNER | one confirm | repeated setup |

```
NO HARDCODED TEMPLATES.
THE TOOL REGISTRY IS THE ALPHABET.
CONFIRMED PLANS BECOME THE MEMORY.
```

## A5. Auto or human

```
AUTO   = all inputs known AND reach in {none, data}
MANUAL = an input is missing OR reach in {customer, money}
```

| Condition | Mode |
| :--- | :--- |
| read-only summary | auto |
| internal delivery | auto |
| create record, inputs known | auto |
| input only known at run time | manual, ask then |
| message a customer | manual confirm |
| move money | manual + owner |

```
JEV IS NEVER ASKED "AUTO OR HUMAN".
CODE DERIVES IT FROM INPUTS AND RISK.
```

## A6. Learned memory

| Input | LLM | JEV | CODE |
| :--- | :---: | :---: | :--- |
| new intent | 1 sketch | 1 batch | compile |
| similar to a learned plan | 0 | 1 choice | fill slots |
| exact repeat | 0 | 0 | instantiate |
| run time | 0 | 0 | execute |

```
"every day at 10 send sales report"   -> new plan, 2 calls
"every day at 8 send stock report"    -> same plan, 1 call
"run daily report now"                -> same plan, 0 calls
```

## A7. Runtime

```
TAP / SCHEDULE / EVENT
        |
        v
GATE    token, grant, version, idempotency
        |
        v
CRUD    one record row, or one balanced set
        |
        v
EVENT   inbox and every canvas update
```

| Rule | Meaning |
| :--- | :--- |
| No model on render | cards read records and metrics |
| No model on run | steps are deterministic |
| One write | one step commits alone |
| Retry safe | same run and step never doubles |
| Nothing erased | delete means archive |
| Reversible | every owner action has one-tap undo |

## A8. Boundary

| Allowed | Not allowed |
| :--- | :--- |
| Compose any existing tool | Invent a tool or screen |
| Read from any allowed record | Model-written SQL |
| Create, update, archive | Hard delete |
| Trigger by tap, schedule, event | Auto step that moves money or messages a customer |
| Owner confirms once | Silent creation from chat |

---

# PART B - USE CASES

## B1. Daily sales report

| Input | Value |
| :--- | :--- |
| User says | "every day at 10 am send me a sales report" |
| Trigger | schedule, 10:00 |
| Card | Daily Sales Report |

| # | CRUD | Step | Input | Mode |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Read | sales summary, yesterday | date range | auto |
| 2 | Create | deliver to owner | summary | auto |

```
+--------------------------------------+
| DAILY SALES REPORT                   |
| Last  today 10:00                    |
| Next  tomorrow 10:00                 |
| [ Run now ]                          |
+--------------------------------------+
```

```
10:00 -> read sales -> create delivery -> card shows last run
```

| First time | After |
| :--- | :--- |
| 1 LLM sketch + 1 JEV choice | 0 model calls |
| owner confirms | runs every day |

## B2. Aambal Neyvagam, handloom

| Input | Value |
| :--- | :--- |
| Brief | silk and cotton sarees, counter, ship across Tamil Nadu |
| User says | "show custom orders waiting and their value; make the flow from confirmed order to delivery" |
| Trigger | order created |
| Card | Custom Weave Orders |

| Choice | Answer |
| :--- | :--- |
| Card action | order create |
| Metrics | open order count, open order value |
| Visibility | owner and admin |
| Steps | advance task, weave, fulfil, invoice, payment, dispatch |

| # | CRUD | Step | Mode | Reach |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Create | advance task | auto | none |
| 2 | Create | start weaving run | manual | data |
| 3 | Update | finish weaving, stock | manual | data |
| 4 | Update | fulfil order | manual | customer |
| 5 | Create | issue invoice | manual | money |
| 6 | Create | record balance | manual | money |
| 7 | Create | dispatch and track | manual | customer |

```
+--------------------------------------+
| [icon] CUSTOM WEAVE ORDERS   [OWNER] |
|                                      |
| Open 6        Value Rs. 1,26,000     |
| Confirmed saree commissions          |
|                                      |
| [ New Custom Order ]                 |
+--------------------------------------+
```

```
tap [New Custom Order]
        |
        v
create order -> start flow
        |
        +-> step 1 auto: advance task
        |
        +-> step 2 waits: [Perform Step 2]
        |
        v
done -> card turns green
```

## B3. Other trades

| Trade | Card | Read | Flow |
| :--- | :--- | :--- | :--- |
| Muthu Mess, food | Lunch Parcels | open orders, payments today | count stock, log expense, clean, lock |
| Iniya Dental, services | Today's Chairs | confirmed bookings, invoice outstanding | issue invoice, record payment, sterilize, count stock |
| Velan Repairs, services | Open Repairs | waiting repairs, value outstanding | issue invoice, record payment, notify customer |
