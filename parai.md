# Autonomous Commerce Store

Goal: a merchant describes the business once. The system builds a commerce site with Shopify, Webflow or Framer polish, with no template choice by the merchant.

## 1. Architecture

```
 BUILD TIME (CI, before deploy)                    RUN TIME (tarharness Worker)
 ─────────────────────────────                     ────────────────────────────
 designmds/*.md  (100 curated, in repo)
   | parse + validate + tag review
   v
 tarharness/src/site/designs/
   index.json        100 rows (small)  ───────────> shortlist (code)
   tokens/<id>.json  parsed tokens     ───────────> render (code)
                                                        |
 MERCHANT                                               v
 description, city, phone, hours  ──> JEV #1 business ──> models, industry
                                                        |
 facts: items, photos, proofs,                          v
        season, notice  ─────────────────────> JEV #2 look (one batch)
                                                 design, recipe per type,
                                                 spotlight/story/trust
                                                        |
                                                        v
                                     CODE: order, layout, gate -> draft
                                                        |
                                  gate fails: draft + missing list
                                  gate passes: ready to publish (the merchant taps)

 tarapp (mobile): calls API for the design list (name, swatches). Never reads .md.
 Loop: hashState(merchant facts + owned photos) changes -> regenerate draft.
```

## 2. Decisions

| # | Decision | Owner |
|---|---|---|
| D1 | Start with 100 curated designs from Refero; no more until the 100 are proven | Team |
| D2 | Raw .md files stay in repo (`designmds/`); they are build input only | Build |
| D3 | Build parses each .md into tokens and an index row; output is committed JSON | Build |
| D4 | Tags (tone, industries, models, density) are proposed, validated by code, and reviewed by a person before commit | Team, code |
| D5 | Tags are never generated at runtime | Build |
| D6 | Jev #2 picks a design only from a code-made shortlist (max 6) | Code |
| D7 | Jev never writes colors, fonts, px values or markup | Jev |
| D8 | Commerce models are a set: products, food, booking, quote, digital, bulk | Jev #1 proposes, code validates |
| D9 | Section order, layout grammar and publish gate are code | Code |
| D10 | Merchant override (design, recipe, settings, text) beats Jev and is stored | Merchant |
| D11 | Checkout, payment, tax, shipping and SEO are code | Code |
| D12 | Jev answers are cached by state hash for 7 days | Code |
| D13 | tarapp never reads .md or token files; it gets the design list from the API | Code |
| D14 | Each design's source license and attribution are recorded before it ships | Team |

## 3. Design library

### 3.1 Storage

| Stage | Location | Size (100 designs) | Who reads it |
|---|---|---|---|
| Source | `designmds/*.md` in git | ~2.5 MB | build only |
| Parsed tokens | `tarharness/src/site/designs/tokens/<id>.json` in git | ~1 MB | Worker, bundled |
| Index | `tarharness/src/site/designs/index.json` in git | ~30 KB | Worker, bundled; API for tarapp |
| Later (only if needed) | R2 bucket for tokens, read by id | — | Worker |

Why bundled first: about 1 MB fits the Worker bundle, so there is no runtime fetch and no cache miss. Moving to R2 is a storage change in the build step and the Worker read path, not a redesign. Move when the library passes about 5 MB, or when designs must change without a deploy.

### 3.2 Build pipeline

```
 designmds/<file>.md
   1. parse      deterministic heading and table parser (no AI)
   2. validate   required tokens, px/rem units, WCAG contrast, id rules
   3. tag        proposed tags + reason; code checks tags against the parsed palette
   4. review     person approves; failures go to review list, not a failed build
   5. emit       tokens/<id>.json, index.json row, source hash, license note
```

Build fails only on a broken index or a duplicate id. A single bad design goes to the review list and is excluded.

### 3.3 Validation

| Check | Rule |
|---|---|
| required tokens | paper, ink, surface, accent, radius, type scale present |
| units | every size in px or rem |
| contrast | body text on paper, and paper on accent, at least 4.5:1 |
| id | one lowercase semantic word, unique across the library |
| tags | tone matches the palette (dark background means dark tone) |
| source | file hash and license note present |

### 3.4 Index row

```json
{ "id": "luxury", "tone": "light", "industries": ["apparel", "jewellery", "craft"],
  "models": ["products", "quote"], "density": "airy", "imagery": "editorial",
  "contrast": 4.9, "swatches": ["#ffffff", "#000000", "#3b281d", "#f7f4f1"] }
```

### 3.5 Shortlist rule

Code filters the index by model and industry, then ranks by tone and density from the brief when present. It returns at most 6 designs. No match returns the default for the industry.

### 3.6 Id migration

| Current id | New id | Source |
|---|---|---|
| dark-luxury | luxury | DESIGN1.md |
| neon-pop | bold | DESIGN2.md |
| harvest-editorial | warm | DESIGN3.md |

Brand names stay in the source files and the license note. They do not appear in ids, UI labels or prompts. Keep the current three working until the 100-design build passes.

## 4. Commerce models

Axis A, the model, drives sections and the publish gate. Axis B, the industry, drives copy and the design shortlist.

| Model | Money moves when | Required sections | Gate: must have |
|---|---|---|---|
| products | customer buys an item | header, hero, catalog, policy, contact, footer | 1 item, contact |
| food | customer orders a meal | header, hero, menu, location, contact, footer | 1 menu item, contact, hours |
| booking | customer books a time | header, hero, booking, faq, contact, footer | 1 bookable service, contact |
| quote | customer asks for a price | header, hero, booking (enquiry), faq, contact, footer | contact, enquiry route |
| digital | customer downloads or subscribes | header, hero, catalog, policy, faq, contact, footer | 1 priced item, contact |
| bulk | business buys in volume | header, hero, catalog, faq, contact, footer | 1 item, enquiry route, minimum order |

- A store can have several models; required sections are the union.
- Optional sections (announcement, spotlight, story, trust) come from facts or Jev yes/no.
- Code rejects an empty model set and asks the merchant when Jev #1 confidence is below 0.6.

## 5. Layout and recipes

### 5.1 Layout grammar (engine, written once)

| Primitive | Meaning |
|---|---|
| stack | vertical blocks, token spacing |
| row | horizontal blocks, wraps at breakpoint |
| grid | n columns, responsive count |
| split | two regions, ratio from token |
| overlay | media with content layer and scrim |
| rail | horizontal scroll strip with snap |
| disclosure | expandable list |

### 5.2 Recipe (data)

One file per recipe under `tarharness/src/site/recipes/<type>/<id>.json`.

```json
{
  "id": "split",
  "type": "hero",
  "models": ["products", "food", "booking", "quote", "digital", "bulk"],
  "needs": { "media": "optional" },
  "layout": { "kind": "split", "ratio": "50/50", "collapse": "stack" },
  "slots": {
    "headline": { "source": "brief.headline", "max": 80 },
    "body":     { "source": "brief.summary", "max": 240 },
    "media":    { "source": "photos[0]", "optional": true },
    "cta":      { "source": "route.primary" }
  },
  "settings": { "reverse": "boolean", "ctaLabel": "text" }
}
```

`settings` is the merchant-editable schema; the editor builds its controls from it.

### 5.3 Section types

| Type | Recipe folder | Used by |
|---|---|---|
| header | `recipes/header/` | all |
| announcement | `recipes/announcement/` | when notice exists |
| hero | `recipes/hero/` | all |
| spotlight | `recipes/spotlight/` | Jev yes/no |
| catalog | `recipes/catalog/` | products, digital, bulk |
| menu | `recipes/menu/` | food |
| booking | `recipes/booking/` | booking, quote |
| story | `recipes/story/` | Jev yes/no |
| trust | `recipes/trust/` | Jev yes/no, needs proof |
| faq | `recipes/faq/` | booking, quote, digital, bulk |
| policy | `recipes/policy/` | products, digital |
| location | `recipes/location/` | food, booking |
| contact | `recipes/contact/` | all |
| footer | `recipes/footer/` | all |

A recipe is eligible only if its file is valid, its layout exists in the grammar, and every slot source resolves from the profile or facts.

### 5.4 Recipe checks

- Schema valid; layout kind in the grammar.
- Slot sources resolve for a sample profile.
- Snapshot at 390, 768 and 1280 px for each design it is shortlisted with (as built: a structural snapshot per design x recipe, plus the CSS and runtime budgets).

### 5.5 Source policy

Applies to every recipe, screenshot, and design file.

| Rule | Detail |
|---|---|
| Structure only | Recipes describe layout and slots. Never copy a reference's text, images, icons, colors, or fonts |
| Tokens only | Recipes reference tokens (`color.ink`), never hex, px, or font names |
| Semantic ids | One lowercase word that names the layout (`fullscreen`, `split`), never a brand or template name |
| Generic defaults | Fallback text is neutral ("Your store name"), never a template's sample copy |
| No third-party assets | No theme files, templates, or scraped HTML/CSS from Shopify, Webflow, Framer or any site |
| Reference note | Each recipe records a structural reference in `source`; the screenshot is not stored |
| Review | A person compares the rendered recipe with the reference pattern before it enters the shortlist |
| Legacy | Existing renderers that break these rules are rewritten or retired, not kept as-is |

## 6. Jev decisions

### 6.1 JEV #1: business

Input: description, city, hours, merchant text blocks.

```json
{ "models": ["products", "booking"], "industry": "apparel",
  "capabilities": { "pos": false, "commerce": true, "site": true, "team": true },
  "confidence": { "models": 0.85, "industry": 0.95 } }
```

### 6.2 JEV #2: look

Input: profile, facts, shortlists, and `avoid` (previous picks).

| Decision | Type | Options | Threshold |
|---|---|---|---|
| design | choice | shortlist, max 6 | confidence >= 0.55 |
| recipe, per section type present | choice | that type's shortlist | confidence >= 0.55 |
| lead | choice | spotlight, catalog, story | confidence >= 0.55 |
| spotlight, story | yes/no | yes, no | probability >= 0.65 |
| trust | yes/no | only if proof exists | probability >= 0.65 |

Below threshold, code uses the default. Jev never invents an option.

## 7. Code rules

- Section order: `header, announcement?, lead, hero, ..., trust?, faq?, policy?, location?, contact, footer`.
- Lead moves one optional section up; everything else keeps its place.
- Gate per model (section 4). A failing gate keeps a draft and lists what is missing.
- Regenerate on `hashState` change. The build regenerates a draft and stops; publishing stays a merchant tap.

## 8. Merchant overrides

| Override | Stored as | Beats Jev |
|---|---|---|
| design | design id | yes |
| recipe per section | recipe id | yes |
| settings | values from settings schema | yes |
| text | slot value | yes |
| section on/off | flag | yes, except required sections |

Overrides survive regeneration. Jev sees them as fixed picks, so it does not fight them.

## 9. End-to-end example

Illustrative. Merchant: handloom saree shop, Chennai. Jev outputs are the target contract.

**Input:** description "Handloom silk sarees, Kanchipuram; ready stock, custom bridal orders"; 42 items with photos; proof "Silk Mark"; season "Pongal sale"; no notice; hours Mon–Sat 10–20.

**JEV #1:** models `products`, `booking`; industry `apparel`. Required: header, hero, catalog, policy, booking, faq, contact, footer.

**Shortlist (code):** design `luxury`, `warm`; hero `split`, `commerce`, `typography`; catalog `grid`, `rail`; booking `list`, `tiers`; faq `disclosure`. Optional candidates: spotlight (season), trust (proof), story.

**JEV #2:**

```json
{ "design": { "choice": "luxury", "confidence": 0.79 },
  "hero": { "choice": "commerce", "confidence": 0.81 },
  "catalog": { "choice": "grid", "confidence": 0.88 },
  "booking": { "choice": "list", "confidence": 0.74 },
  "lead": { "choice": "spotlight", "confidence": 0.66 },
  "spotlight": { "yes": true, "probability": 0.88 },
  "trust": { "yes": true, "probability": 0.74 },
  "story": { "yes": false, "probability": 0.42 } }
```

**Draft (code):**

```
 1 header     split              (default)
 2 spotlight  overlay            "Pongal sale"
 3 hero       commerce
 4 catalog    grid               42 items
 5 trust      row                "Silk Mark"
 6 booking    list               needs 1 service -> missing
 7 policy     disclosure
 8 faq        disclosure
 9 contact    whatsapp
10 footer     contact-card
```

**Result:** gate FAIL (booking): "add 1 bookable service with price". Draft saved, not published. After the merchant adds the service the draft regenerates, and the next tap publishes. A products-only store publishes on that tap with no other merchant action.

## 10. Shopify replacement

| Approach | Strength | Weakness |
|---|---|---|
| LLM-generated HTML | variety | consistency, verification, cost |
| Shopify-style builder | checkout, apps, editor, SEO | fixed themes, cost, local payments |
| This plan | consistent, safe, fast setup, overrides through settings | commerce depth still growing |

Gap priority:

| # | Gap | Built on |
|---|---|---|
| 1 | Public cart and checkout | Done: `src/site/checkout.ts` re-prices the posted cart through `order.create`; the storefront posts `/order` and the sites worker forwards it; the owner turns ordering on with `site.sections.set ordering=on` |
| 2 | Merchant overrides | settings schema, stored overrides |
| 3 | SEO, sitemap, custom domain | site release |
| 4 | Customer accounts, order tracking | order records |
| 5 | Shipping and tax rules | commerce kernel |
| 6 | Conversion feedback into `avoid` | analytics |
| 7 | More recipes per type | recipe folders |

## 11. Build order

Keep the current site working at every step. 1 to 11 and 13 to 15 are built; 12 is open and 16 stays deferred.

1. Add `models` to the profile; validate JEV #1 output against section 4.
2. Replace `kind` with `models` in blueprint and gate.
3. Build step: parse the three existing DESIGN*.md files into `tokens/` and `index.json`; run validation.
4. Switch `design.ts` to read the bundled library; migrate ids (section 3.6).
5. Expose the design list API for tarapp (name, swatches).
6. Define the layout grammar and recipe schema.
7. Convert current renderers to recipes: header, hero variants, catalog, footer, contact.
8. Add recipes for missing types: spotlight, story, trust, booking, menu, faq, policy, location.
9. Shortlist code and JEV #2 batch.
10. Override storage and editor from settings schemas.
11. Snapshot checks per design x recipe x width.
12. Expand the library to 100 designs through the build pipeline and review list.
13. Regenerate on `hashState`; a gate that passes makes the draft publishable, never published.
14. One backend call to publish (`site.publishLatest`).
15. Remove unused `patterns/` code (`selector.ts`, `catalog.ts`, `renderSectionByPatternId`).
16. Move tokens to R2 only if the library passes about 5 MB or needs deploy-free updates.
