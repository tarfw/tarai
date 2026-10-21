# Cards + Flows

| Part | Holds |
| :--- | :--- |
| A | Concept: CRUD, 3 gates, 4 modifiers, Jev, planner, runtime |
| B | Core use cases: report, handloom, refund |
| C | Domain examples: 8 domains, 5 flows each |

```
THE IDEA
  CRUD tools are the alphabet.
  3 gates + 4 modifiers are the grammar.
  LLM generates. JEV decides. CODE compiles.
  Confirmed plans become memory.
  Runtime is deterministic.
```

```
1 plan grammar
1 step schema
3 gates
4 modifiers
0 hardcoded templates
0 model calls at runtime
```

---

# PART A - CONCEPT

## A1. One screen

```
WORDS or TAP
     |
     v
PLAN    LLM sketches, JEV picks, CODE wires
     |
     v
CARD    saved read + one tap
     |
     v
GATE    grant, version, idempotency
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
| no | owner sees one clear gap, no fake step |

## A3. Primitives

| Word | Meaning | Example |
| :--- | :--- | :--- |
| Card | Saved read + one tap | Daily Sales Report |
| Flow | Saved CRUD sequence | Custom Textile Order |
| Step | One existing tool call | Issue invoice |
| Gate | Who acts on the step | auto, ask, approve |
| Modifier | How the step repeats or reverses | retry, repeat, undo, match |
| Run | One execution of a flow | Run 104, step 2 of 7 |
| Metric | A saved read | open orders, value |
| Trigger | When a flow starts | tap, schedule, event |
| Memory | A confirmed plan reused later | daily report pattern |

## A4. Step grammar

```
PLAN
  trigger  tap | schedule | event
  steps    [ step, step, ... ]        max 12
  card     title + 0-2 metrics + 1 tap

STEP
  crud     C | R | U | D
  tool     one existing action
  input    known at plan time or ask at run time
  gate     auto | ask | approve
  mod      none | retry | repeat | undo | match
```

| Field | Rule |
| :--- | :--- |
| Trigger | Jev picks from tap, schedule, event |
| Tool | Jev picks from registered actions only |
| Input | wired from an earlier output or asked at run |
| Gate | Jev picks, code enforces the safety floor |
| Modifier | Jev picks, code checks the tool supports it |
| Card | generated from the plan, not authored twice |

```
NO HARDCODED TEMPLATES.
THE TOOL REGISTRY IS THE ALPHABET.
CONFIRMED PLANS BECOME THE MEMORY.
```

## A5. Three gates and four modifiers

```
GATES                         MODIFIERS
auto     code acts            retry   once on failure
ask      person acts          repeat  again until state, or each row
approve  owner decides        undo    opposite posting
                              match   read two sources, update match
```

| Gate | Who acts | When |
| :--- | :--- | :--- |
| auto | code | inputs known, no money or customer risk |
| ask | the person | input missing, or a physical step |
| approve | owner or admin | money, customer, or over limit |

| Modifier | Meaning | Scope |
| :--- | :--- | :--- |
| retry | run once more on failure | step |
| repeat | run again until a state changes, or once per row | flow or row |
| undo | write the opposite posting | step |
| match | read two sources, update the match | plan |

```
JEV PICKS TOOL, GATE, MODIFIER.
CODE CHECKS THE TOOL SUPPORTS THEM.
IF NOT, CODE FALLS BACK TO THE DERIVED GATE AND MODIFIER.
```

## A6. The 8 old shapes are combinations

| Shape | Gate | Modifier |
| :--- | :--- | :--- |
| straight | auto | - |
| human | ask | - |
| approval | approve | - |
| retry | auto or ask | retry |
| loop | auto | repeat |
| batch | auto | repeat, each row |
| reconcile | auto | match |
| reverse | approve | undo |

```
straight   auto
human      ask
approval   approve
retry      auto/ask + retry
loop       auto + repeat
batch      auto + repeat each
reconcile  auto + match
reverse    approve + undo
```

## A7. Jev decisions

```
ONE JEV REQUEST
  trigger choice
  step_i tool choice
  step_i gate choice
  step_i modifier choice
  step_i needed noul
  plan complete noul
```

| Signal | Use |
| :--- | :--- |
| Choice argmax | pick tool, gate, modifier |
| Top-2 fallback | top is invalid or unsafe |
| Noul | step needed, plan complete, approval |
| Score | best of 2 valid plans, only on a tie |
| Plan confidence | min of step confidences, free |

| Rejected | Why |
| :--- | :--- |
| Self-consistency, repeat N times | cost and latency |
| Beam search over plans | complexity |

```
LLM generates candidates.
JEV generates probabilities over closed choices.
CODE composes the highest valid plan.
MEMORY removes the model calls next time.
RUNTIME is deterministic.
```

| Risk | Auto if | Else |
| :--- | :--- | :--- |
| none, data | >= 0.60 | ask |
| customer | >= 0.80 | confirm |
| money | >= 0.85 | confirm + owner |

## A8. AI map

| Stage | Who | Job |
| :--- | :--- | :--- |
| Understand | LLM | goal, trigger, step phrases |
| Extract slots | LLM | time, target, report |
| Decide | Jev | tool, gate, modifier, trigger |
| Verify | Jev | step needed, plan complete, approval |
| Rank | Jev | best of 2 valid plans |
| Write | LLM | card name, description, report prose |
| Explain | LLM | why this plan, in plain words |
| Repair | LLM + Jev | one retry only |
| Compute | Code | counts, sums, money, stock |
| Commit | Code | gate, version, idempotency, record |

| Never | Why |
| :--- | :--- |
| LLM picks ids | hallucination |
| Jev writes prose | not its job |
| model computes totals | code owns numbers |
| model grants permission | code owns access |
| model commits a record | code owns truth |

## A9. Plan once, run forever

```
WORDS
  |
  v
LLM    sketch
  |
  v
JEV    pick tool, gate, modifier
  |
  v
CODE   wire, validate, derive gate
  |
  v
OWNER  confirm once
  |
  v
MEMORY save the plan
  |
  v
RUN    0 model calls
```

| Input | LLM | JEV | CODE |
| :--- | :---: | :---: | :--- |
| new intent | 1 sketch | 1 batch | compile |
| similar to memory | 0 | 1 choice | fill slots |
| exact repeat | 0 | 0 | instantiate |
| run time | 0 | 0 | execute |

```
"every day at 10 send sales report"  -> new plan, 2 calls
"every day at 8 send stock report"   -> same plan, 1 call
"run daily report now"               -> same plan, 0 calls
```

## A10. Gate safety floor

```
JEV PICKS A GATE.
CODE UPGRADES IT WHEN RISK IS HIGHER.
```

| Jev says | Risk | Code makes it |
| :--- | :--- | :--- |
| auto | money | approve |
| auto | customer message | ask or approve |
| ask | money | approve |
| approve | any | approve |

```
AUTO    = all inputs known AND reach in {none, data}
ASK     = an input is missing, or a physical step
APPROVE = money, customer, or over limit
```

## A11. Runtime

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

## A12. Boundary

| Allowed | Not allowed |
| :--- | :--- |
| Compose any existing tool | Invent a tool or screen |
| Read from any allowed record | Model-written SQL |
| Create, update, archive | Hard delete |
| Trigger by tap, schedule, event | Auto step that moves money or messages a customer |
| Owner confirms once | Silent creation from chat |

---

# PART B - CORE USE CASES

## B1. Daily sales report

| Input | Value |
| :--- | :--- |
| User says | "every day at 10 am send me a sales report" |
| Trigger | schedule, 10:00 |
| Card | Daily Sales Report |

| # | CRUD | Step | Gate | Mod |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Read | sales summary, yesterday | auto | - |
| 2 | Create | deliver to owner | auto | - |

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
| Brief | silk and cotton textiles, counter, ship across Tamil Nadu |
| User says | "show custom orders waiting and their value; make the flow from confirmed order to delivery" |
| Trigger | order created |
| Card | Custom Weave Orders |

| Choice | Answer |
| :--- | :--- |
| Card action | order create |
| Metrics | open order count, open order value |
| Visibility | owner and admin |
| Steps | advance task, weave, fulfil, invoice, payment, dispatch |

| # | CRUD | Step | Gate | Mod |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Create | advance task | auto | - |
| 2 | Create | start weaving run | ask | - |
| 3 | Update | finish weaving, stock | ask | - |
| 4 | Update | fulfil order | ask | - |
| 5 | Create | issue invoice | approve | - |
| 6 | Create | record balance | approve | - |
| 7 | Create | dispatch and track | ask | - |

```
+--------------------------------------+
| [icon] CUSTOM WEAVE ORDERS   [OWNER] |
|                                      |
| Open 6        Value Rs. 126,000      |
| Confirmed custom orders              |
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
        +-> step 2 asks: [Perform Step 2]
        |
        v
done -> card turns green
```

## B3. Refund approval

| Input | Value |
| :--- | :--- |
| User says | "refunds above Rs. 2,000 need my approval" |
| Trigger | refund request |
| Card | Refunds |

| # | CRUD | Step | Gate | Mod |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Read | read invoice and payment | auto | - |
| 2 | Create | create refund | approve | - |
| 3 | Update | reverse invoice balance | approve | undo |
| 4 | Create | notify customer | ask | - |

```
+--------------------------------------+
| REFUNDS                              |
| Pending 2      Refunded Rs. 8,400    |
| [ Review Refund ]                    |
+--------------------------------------+
```

```
request -> read -> owner approves?
                        |
              no -------+------> stop, card shows declined
                        |
                       yes
                        |
                        v
                 create refund -> reverse balance -> notify
```

---

# PART C - DOMAIN EXAMPLES

## C1. Sales

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Quote follow-up | quote saved | Read quote -> Create task | ask | - | Open Quotes |
| Counter sale | tap | Create order -> Create payment -> Update stock | auto | - | Counter Sales |
| Bulk order | tap | Create order -> reserve stock -> Create invoice | auto | - | Bulk Orders |
| Unpaid quote chase | schedule | Read quotes -> message -> Create task | auto | repeat | Overdue Quotes |
| Daily sales report | schedule | Read sales -> Create delivery | auto | - | Sales Today |

## C2. Marketing

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Lead follow-up | contact created | Read contact -> Create task -> message | ask | - | New Leads |
| Review request | shipment delivered | Read order -> message -> Create task | auto | - | Reviews |
| Festival campaign | schedule | Read contacts -> Create task -> message | auto | repeat each | Campaign |
| Website enquiry | site enquiry | Read enquiry -> Create task -> reply | ask | - | Enquiries |
| Repeat customer offer | schedule | Read orders -> Create task -> message | auto | repeat each | Repeat Customers |

## C3. Support

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Ticket intake | message received | Create task -> assign -> reply | ask | - | Open Tickets |
| Refund request | tap | Read invoice -> Create refund -> Create task | approve | undo | Refunds |
| Warranty claim | tap | Read order -> Create task -> Create shipment | ask | - | Claims |
| SLA escalation | schedule | Read open tickets -> Create owner task | auto | repeat | Overdue Tickets |
| Feedback follow-up | task completed | message -> Create task | auto | - | Feedback |

## C4. Money

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Cash close | schedule | Read payments -> count -> Create posting | ask | - | Cash Today |
| Overdue reminder | schedule | Read invoices -> message -> Create task | auto | repeat | Overdue |
| Expense capture | photo or tap | Create expense -> Create posting | auto | - | Expenses |
| Bank reconciliation | tap | Read statement -> match -> Update reconciliation | auto | match | Unreconciled |
| GST return | monthly | Read invoices -> Create report -> deliver | auto | repeat each | GST Due |

## C5. Stock and purchase

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Low stock reorder | stock.low | Read stock -> Create purchase -> Create task | auto | - | Low Stock |
| Goods receipt | delivery | Read purchase -> Update stock -> Create receipt | auto | match | Inbound |
| Stock count | schedule | Read stock -> Create adjustment | ask | - | Stock Count |
| Transfer | tap | Read stock -> Update stock -> Create movement | auto | - | Transfers |
| Supplier payment | schedule | Read payables -> Create payment | approve | - | Payables |

## C6. Production

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Start run | tap | Read recipe -> Create production -> Update materials | ask | - | Active Runs |
| Finish run | tap | Update production -> Update stock -> Create posting | auto | - | WIP |
| Quality check | tap | Read production -> Create inspection -> Update stock | ask | - | QC |
| Scrap | tap | Create movement -> Update stock | auto | - | Scrap |
| Work order schedule | schedule | Read orders -> Create plan task | auto | repeat each | Work Orders |

## C7. People

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Shift handover | schedule | Read shift -> Create task -> Create note | ask | - | Handover |
| Attendance | tap | Create attendance | auto | - | Attendance |
| Payroll | monthly | Read attendance -> Create payroll -> Create payment | approve | - | Payroll |
| Leave request | event | Read member -> Create task -> Update attendance | ask | - | Leave |
| Onboarding | member invited | Create document task -> Create training task | auto | repeat each | Onboarding |

## C8. Delivery

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Pack order | order paid | Read order -> Create pack -> Update order | auto | - | To Pack |
| Dispatch | tap | Read order -> Create shipment -> message tracking | ask | - | Dispatch |
| Delivery confirm | courier event | Update shipment -> Create task | auto | - | Delivered |
| Failed delivery | failure event | Read shipment -> Create task -> reschedule | auto | retry | Failed |
| Route trip | schedule | Read shipments -> Create trip -> assign driver | auto | repeat each | Routes |

## C9. Compliance

| Flow | Trigger | Steps (CRUD) | Gate | Mod | Card |
| :--- | :--- | :--- | :--- | :--- | :--- |
| License expiry | schedule | Read licenses -> Create task | auto | repeat | Expiring |
| Document vault | tap | Create document | auto | - | Documents |
| Audit export | schedule | Read events -> Create report | auto | - | Audit |
| Backup check | schedule | Read backup -> Create task if failed | auto | retry | Backup |
| Statutory filing | schedule | Read financials -> Create report -> deliver | approve | - | Filing |

## C10. Shape to gate and modifier

| Shape | Gate | Modifier | Used by |
| :--- | :--- | :--- | :--- |
| straight | auto | - | report, sale, receipt, finish run, audit |
| human | ask | - | count cash, stock count, dispatch, handover |
| approval | approve | - | refund, invoice, payroll, supplier payment, filing |
| retry | auto | retry | failed delivery, backup check |
| loop | auto | repeat | unpaid quote, overdue reminder, SLA, license expiry |
| batch | auto | repeat each | campaign, repeat offer, GST, work orders, onboarding, routes |
| reconcile | auto | match | bank match, goods receipt |
| reverse | approve | undo | refund, cancel order |
