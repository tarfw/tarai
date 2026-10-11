# Autonomous Commerce Store

Goal: replace Shopify-style store builders for small and medium merchants, with the store set up automatically from the merchant's brief.

## 1. Final design

```
 WORKSPACE BRIEF
   description, city, phone, hours
        |
        v
 JEV #1  workspace      -> models, industry, capabilities
        |
        v
 PROFILE (brief record) <- items, photos, proofs, season, notice (facts)
        |
        v
 CODE    required section types from models
        |
        v
 JEV #2  look           -> one variant per section type, yes/no optionals
        |
        v
 CODE    order, gate, render -> draft
        |
        +-- gate fails -> draft + missing list
        +-- gate passes -> publish (live)
        |
 hashState(profile + facts) changes -> regenerate draft
```

## 2. Decisions

| # | Decision | Owner |
|---|---|---|
| D1 | Two Jev calls per store: workspace (JEV #1) and look (JEV #2) | Jev |
| D2 | Commerce models set: products, food, booking, quote, digital, bulk | Jev #1 returns, code validates |
| D3 | Industry is a label for copy and look only; it never changes sections | Jev #1 |
| D4 | Section types are fixed in code; Jev picks a variant, never invents a section | Code |
| D5 | Each section type has a folder; a variant has a renderer and a fact list | Code |
| D6 | Publish gate is per model (section 5) | Code |
| D7 | Jev answers are cached by state hash for 7 days | Code |
| D8 | Merchant can override any Jev pick; override wins over Jev | Merchant |
| D9 | Checkout, payments, tax, shipping and SEO are code, not Jev | Code |

## 3. Section types and variants

One folder per type under `tarharness/src/site/primitives/`.

| Type | Folder | Variants | Picked by |
|---|---|---|---|
| announcement | announcement/ | scrolling, quiz_pill | Jev #2 |
| header | header/ | minimal, floating_pill, centered_logo, cowboy | Jev #2 |
| hero | hero/ | split, commerce, typography, atmospheric, cowboy | Jev #2 |
| spotlight | spotlight/ | offer_banner | Jev #2 yes/no |
| catalog | catalog/ | clean_grid | code (item count) |
| menu | menu/ | list | code (food model) |
| booking | booking/ | services_list | code (booking model) |
| story | story/ | founder | Jev #2 yes/no |
| trust | trust/ | proof_strip | Jev #2 yes/no, needs proof |
| faq | faq/ | accordion | code |
| policy | policy/ | shipping_returns | code |
| location | location/ | hours_map | code |
| contact | contact/ | whatsapp | code, always |
| footer | footer/ | contact_card, cowboy | code, always |

Missing renderers today: spotlight, story, trust, contact, faq, policy, location, booking, menu. Hero `minimal` is offered by Jev but has no renderer.

## 4. Section order

Fixed by code. Jev #2 chooses which optional sections exist and which variant each uses.

```
 header -> announcement? -> lead -> hero -> ... -> trust? -> faq? -> policy? -> location? -> contact -> footer
```

`lead` is the one Jev choice that moves a section up: spotlight, catalog, or story.

## 5. Model to sections and gate

| Section | products | food | booking | quote | digital | bulk |
|---|---|---|---|---|---|---|
| header, hero, contact, footer | yes | yes | yes | yes | yes | yes |
| announcement | if notice | if notice | if notice | if notice | if notice | if notice |
| catalog | yes | no | no | no | yes | yes |
| menu | no | yes | no | no | no | no |
| booking | no | no | yes | no | no | no |
| faq | no | no | yes | yes | yes | no |
| policy | yes | no | no | no | yes | yes |
| location | no | yes | yes | no | no | no |
| spotlight, story, trust | Jev | Jev | Jev | Jev | Jev | Jev |

| Model | Gate: must have |
|---|---|
| products | 1 item, contact |
| food | 1 menu item, contact, hours |
| booking | 1 service, contact |
| quote | contact, enquiry route |
| digital | 1 priced item, contact |
| bulk | 1 item, enquiry route, minimum order quantity |

## 6. Build order

1. Save `models` in the profile; validate Jev #1 output against the six models.
2. Replace `kind` with `models` in the blueprint and the gate.
3. Section registry: one entry per type (folder, variants, required facts). Replace the `purpose` switch in `registry.ts`.
4. Add renderers for missing types, one variant each, starting with contact, trust, faq, policy.
5. Jev #2: one choice question per present type, options taken from its folder only.
6. Remove or implement hero `minimal`.
7. Regenerate on `hashState` change; auto-publish when the gate passes and the merchant has not overridden.
8. Publish as one backend call (`site.publishLatest`).
9. Remove unused `patterns/selector.ts`, `renderSectionByPatternId`, and `patterns/catalog.ts` after step 3 (keep descriptions if useful).

## 7. Shopify replacement

### Position

| Approach | Good at | Weak at |
|---|---|---|
| LLM-generated HTML | variety | consistency, verification, cost |
| Shopify-style builder | checkout, apps, editor, SEO | fixed themes, subscription cost, local payments |
| Jev picks variants (this plan) | fast, safe, consistent setup | visual range, commerce depth (not built yet) |

The plan wins on setup. It does not yet match Shopify on commerce, so the next work is commerce.

### Gaps and order

| Priority | Gap | Built on |
|---|---|---|
| 1 | Public cart and checkout | `order.create`, `payment.record` actions |
| 2 | Merchant override of Jev picks | profile field that beats Jev |
| 3 | SEO (meta, sitemap, structured data), custom domain | site release |
| 4 | Customer accounts and order tracking | order records |
| 5 | Shipping and tax rules | commerce kernel |
| 6 | More variants per section type | folders |
| 7 | Conversion feedback into Jev `avoid` | analytics |

## 8. End-to-end example

Illustrative. Merchant: a saree shop in Chennai. Inputs are real facts from the brief and records. Jev outputs are shown in the target contract; values are examples, not production output.

### 8.1 Merchant input

```
description : "Handloom silk sarees, Kanchipuram. Ready stock and custom bridal orders."
city        : Chennai
phone       : +91 98xxx xxxxx
hours       : Mon-Sat 10:00-20:00
items       : 42 (with price and photo)
proofs      : ["Silk Mark"]
season      : "Pongal sale"
notice      : none
```

### 8.2 Jev #1 (workspace)

Input: `description`, `city`, `hours`.

```json
{
  "models": ["products", "booking"],
  "industry": "apparel",
  "capabilities": { "pos": false, "commerce": true, "site": true, "team": true },
  "confidence": { "products": 0.93, "booking": 0.71, "apparel": 0.95 }
}
```

Code: `booking` is a secondary model because of the bridal orders, so the site gets the booking section too. Confidence below 0.6 would ask the merchant instead.

### 8.3 Code: required sections

From models `products` + `booking`:

```
header, hero, catalog, policy, booking, faq, contact, footer
```

Optional yes/no candidates (from facts and industry): spotlight (season present), trust (proof present), story.

### 8.4 Jev #2 (look)

Input state:

```json
{
  "profile": { "industry": "apparel", "models": ["products", "booking"], "city": "Chennai" },
  "facts": { "items": 42, "proofs": ["Silk Mark"], "season": "Pongal sale" },
  "avoid": []
}
```

Questions, one per present type plus optionals:

```json
{
  "hero":      { "choice": "commerce",  "confidence": 0.81, "options": ["split","commerce","typography","atmospheric","cowboy"] },
  "look":      { "choice": "dark-luxury", "confidence": 0.77, "options": ["dark-luxury","neon-pop","harvest-editorial"] },
  "lead":      { "choice": "spotlight", "confidence": 0.66, "options": ["spotlight","catalog","story"] },
  "spotlight": { "yes": true,  "probability": 0.88 },
  "trust":     { "yes": true,  "probability": 0.74 },
  "story":     { "yes": false, "probability": 0.42 }
}
```

Code applies threshold 0.65 to yes/no answers and 0.55 to choices. `story` is dropped, `spotlight` leads.

### 8.5 Code: order, gate, draft

```
 1 header        (minimal)
 2 hero          commerce   (Jev)
 3 spotlight     offer_banner, "Pongal sale"   (Jev lead)
 4 catalog       clean_grid, 42 items          (code)
 5 trust         proof_strip, "Silk Mark"      (Jev yes)
 6 booking       services_list                 (code)
 7 policy        shipping_returns              (code)
 8 faq           accordion                     (code)
 9 contact       whatsapp                      (code)
10 footer        contact_card                  (code)
```

Gate, products: 42 items >= 1, phone present -> pass. Booking: needs 1 service. The bridal order service is not in the facts, so gate fails for booking.

### 8.6 Result

```
 gate: FAIL (booking)  missing: "1 bookable service with price"
 draft: saved (revision 1), NOT published
 merchant sees: product store ready; add a bridal service to go live
```

After the merchant adds the service, `hashState` changes, the draft regenerates with the booking variant, the gate passes, and it publishes.

Had the merchant had only products, the gate would pass at step 8.5 and publish automatically.

## 9. Status

| Item | Status |
|---|---|
| Legacy compat fields removed (`judgment.ts`) | Done |
| Duplicate `defaultBlueprint` removed (`build.ts`) | Done |
| Tests after cleanup | 174 passing |
| `models` field | Not built |
| Section registry | Not built |
| Missing renderers | Not built |
| Unused `patterns/` code | Still present; remove after registry |
| Public checkout | Not built |
