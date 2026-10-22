# The Certainty Ladder

> **One idea:** never pay for a decision you could have made without a model.
> Every request walks down a fixed ladder. Each rung has one exit test.
> Jev is used at exactly one rung.

---

## The ladder

```
 WORDS / TAP
     |
     v
 [L0] LITERAL -------------------------------------> plan          0 calls
     |  no match
     v
 [L1] MEMORY  -------------------------------------> plan          0-1 calls
     |  no near match
     v
 [L2] PROSE   (LLM)   step phrases --------------->               1 call
     |
     v
 [L3] DECIDE  (Jev)   tool / variant / risk /     -->               1 call
     |                rank / gap
     v
 [L4] VERIFY  (Jev)   does each step match? ------>               1 call
     |
     v
 [L5] CONFIRM (human) approve the plan
     |
     v
 [COMPILE] --------------> static artifact
     |
     v
 [RUN] -----------------> 0 model calls, forever
```

---

## Three lanes

```
 +----------------------+--------------------------------+
 | LANE                 | OWNS                          |
 +----------------------+--------------------------------+
 | DETERMINISTIC (code) | numbers, money, counts,       |
 |                      | dates, gates, permissions     |
 +----------------------+--------------------------------+
 | DECISION (Jev)       | which of these N?             |
 |                      | how risky? how useful?         |
 +----------------------+--------------------------------+
 | LANGUAGE (LLM)       | the words                     |
 +----------------------+--------------------------------+
 | EXECUTION (code)     | the commit. always.           |
 +----------------------+--------------------------------+

 A lane never crosses.
 Model never computes. Never commits. Never grants.
```

---

## The rungs

| Rung | Who | Calls | Question it answers | Exit test |
|---|---|---|---|---|
| L0 Literal | code | 0 | does the wording match a known intent? | exact match -> compile |
| L1 Memory | code + Jev | 0-1 | is this the same shape as a saved plan? | near match -> fill slots |
| L2 Prose | LLM | 1 | what are the steps, in words? | always -> L3 |
| L3 Decide | Jev | 1 batched | which tool? which variant? how risky? how useful? | p + margin -> L4 |
| L4 Verify | Jev | 1 batched | does each step actually do this? | all yes -> L5 |
| L5 Confirm | human | 0 | is this what you meant? | approve -> compile |
| Run | code | 0 | -- | forever |

---

## The only three questions

```
 ONE REQUEST
 +----------------------------------------------------+
 |  state  (filtered to what the questions need)      |
 |                                                    |
 |  q1  CHOICE  which tool?                           |
 |  q2  CHOICE  which variant?                        |
 |  q3  NOUL    does this move money?                 |
 |  q4  NOUL    is this card useful now?              |
 |  q5  SCORE   how urgent?                           |
 +----------------------------------------------------+
            |
            v
     one batched call -> many typed answers
```

| Type | Ask | Use for | Never |
|---|---|---|---|
| CHOICE | pick one of N | tool, variant, design, template | when N is large -> split into levels |
| NOUL | how likely yes | risk, gap, needed, useful | to compute anything |
| SCORE | where on a ladder | urgency, tier, quality | to get an exact number |

Batch freely. 13 questions in one call = ~12x cheaper, ~10x faster, same answers.

---

## Reading the answer

```
 p(chosen)   0.86  ---.
 p(top2)     0.11  ---+---> margin = 0.75   confident
 confidence  0.41  ---'                      -> act
```

| Signal | Meaning | Use |
|---|---|---|
| p(chosen) | chance the pick is right | above threshold -> act, else ask |
| margin | p(top1) - p(top2) | small margin -> ambiguous, ask |
| confidence | how concentrated the spread is | only to detect "spread out" |

Never auto-act on confidence alone.

---

## Rules

1. Never ask for an id the model did not see. Shortlist in code, model selects.
2. Never let a model compute a number, count, total or compare dates.
3. One request, many questions. Never one request per question.
4. Cache on (model version + question version + exact state that question reads).
5. Pin the model id, not the alias. Aliases move under you.
6. Every deep-path answer must graduate to the fast path, or the bill never drops.
7. Money or customer = confirm. Always. Not model-decided.
8. Send only what the question needs. Extra detail is noise, not context.

---

## Payoff

| Request | Naive | Ladder |
|---|---|---|
| known intent | 3 calls | 0 |
| similar intent | 3 calls | 1 |
| new intent | 5 calls | 3 |
| every run afterwards | 3 calls | 0 |
| a card's glance value | a model call | a materialized read |

```
 calls
   ^
 5 |                                          *
   |                                          |
 3 |                              *          *
   |                              |          |
 1 |            *                |          |
   |            |                |          |
 0 +------------+------------------+----------+----> time
        known      similar         new      every run
```

---

## Anti-patterns

| Bad | Why | Instead |
|---|---|---|
| model picks the gate | policy, not judgement | derive from reach |
| model picks ids from memory | hallucination | shortlist in code first |
| one call writes and decides | mixed lanes | split into L2 then L3 |
| one call per question | n x cost, n x latency | batch into one |
| confidence above .6 -> auto | confidence is not correctness | use p + margin |
| retry until it works | unbounded cost | one targeted repair |
| big state, one question | distractor | filter state in code |
