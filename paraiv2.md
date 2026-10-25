# Site Methods v2 — One Door, Two Depths

> Governing law: [tarfw.md](tarfw.md) §Site. This file refines Mode 1 / Mode 2.

Goal: every merchant gets a 0-FAIL site at birth for near-zero cost, and
the few who want "mine" get an agent-built one — through the same door,
the same URL, the same gate. Replaces the single-pipeline design in
`parai.md`.

```
SITE = one tool, one door, two depths.

              the merchant
                    |
        [ View Store ]  same URL forever
                    |
            +---------+---------+
            |                   |
     METHOD 1              METHOD 2
     JEV CURATED           GATED STUDIO
     (default, birth)      (upgrade tap, asked)
            |                   |
            +--------+----------+
                     |
                THE GATE            the door. nothing skips it.
          lint 0/0 + inspect 0 FAIL
          in a real browser.
                     |
        publish = immutable release in R2
        rollback repoints. never edits.
```

## Method 1 — JEV CURATED

```
 birth      words -> Jev names the nature (food .92) -> code deals
            the recipe. zero model calls after Jev. seconds.
 recipe     not a template: a frozen 0-FAIL site. born as a
            Gated Studio run (see flywheel), distilled: keep the
            output, delete the generation. reviewed at build time.
 assembly   recipe x catalog slice (items, prices, hours, address,
            merchant photos). data injection, code only.
 cost       ~Rs 1-2 lifetime. Rs 0/month serving (R2 + worker).
 ceiling    per-nature: every food counter shares a coat.
            most merchants never notice.
```

## Method 2 — GATED STUDIO

```
 trigger    "make it mine" in Ask. opens the VM. priced per session.
 deal       nature -> one direction from the studied library
            (seeded, recorded; reproducible: seed + catalog hash).
 content    catalog slice fills the slots. merchant photos first,
            licensed library second. DATA IS NEVER GENERATED:
            no checkout, payment, tax, price, stock. looks only.
 build      pi + tasteskill inside an agentOS VM, image pre-baked
            (node, fonts, chromium, skill). 5-10 min, 1-3 min edits.
 gate       same gate. 3 fix rounds max. fail -> last good release
            stays live. the merchant never sees a broken site.
 cost       Rs 8-15 per site, Rs 2-5 per edit. VM sleeps after.
 ceiling    per-merchant: the idea comes from their own world
            (their oven, their street, their name).
```

## The Gate (shared, the actual product)

```
 gate       = lint (banned patterns) + inspect (real Chromium:
             contrast, overflow, headline wrap, edge text, motion,
             type, margins). deterministic. no LLM. ~30s.
 runs on    1. recipes at distill time (pre-certified)
            2. every assembly at publish (data can break layouts)
            3. every studio output before release
 verdict    0 FAIL or no release. fallback = last passing release.
 why        any model can generate a site. the gate is what makes
            it not slop. the certificate is the product.
```

## The Flywheel

```
 studio     is the recipe FACTORY. curations is the shelf.
            team runs the studio offline: one direction per nature
            per quarter. each 0-FAIL output distills into a recipe.
            quality of Method 1 == quality of Method 2, for free.
 today      v2 (stationery) + v4 (arch motif) runs are already
            two proven recipes for the food nature. seed + data
            hash recorded. reproducible.
```

## Laws

1. One door. the URL never changes. mode changes, URL does not.
2. The gate is the door. nothing publishes a real browser hasn't passed.
3. Data is never generated. the LLM writes looks only, by structure
   (menu.ts law: prices, GST, WhatsApp render from the catalog record).
4. Same schema both methods. a studio site can be served by the
   curated path tomorrow (it distills into a recipe).
5. Recipes are born gated. no hand-designed templates, ever.

## Costs (per merchant)

| | JEV CURATED | GATED STUDIO |
|---|---|---|
| birth | seconds | 5-10 min |
| cost | ~Rs 1-2 lifetime | Rs 8-15 / site |
| edits | free (data) | Rs 2-5 / session |
| serving | Rs 0/month | Rs 0/month |
| model after birth | none | per session |
| infra | Cloudflare only | + agentOS VM (sleeps) |

## Build order

```
 1  gate into the sites worker publish path   (both methods need it)
 2  distill v2 + v4 into the first recipes    (already proven)
 3  JEV birth flow: nature -> recipe -> gate -> release
 4  studio tap: VM, seeded with the merchant's recipe (--keep)
```

The line: Jev deals the coat, the studio tailors it, and the gate is
the door.
