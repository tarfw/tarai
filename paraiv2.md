# Site Builder — Complete, Simple Plan

## The Big Picture

A merchant's website is assembled in **<1ms** from **3 pieces**:

| # | Piece | Source | Picked / built by | Output |
|---|---|---|---|---|
| 1 | **Merchant data** (items, prices, photos) | Workspace DB | — | Content |
| 2 | **Section stack** (ordered list of sections) | `sections/` | Jev | Layout |
| 3 | **Brand style** (colors, fonts, radii, spacing) | `styles/*.json` (from Refero) | Jev | Look |
| | **= Live website** | | | |

---

## 1. Model Choice for Mode 1

**Mode 1 brain = Jev (style + section stack) + DeepSeek-V4-Flash-0731 (short copy).**

| Model | Job in Mode 1 | Speed | Cost per Site |
|---|---|---|---|
| **Jev** | Picks `styleId` + ordered `sections[]` from merchant words and DB stats | ~50ms | Near ₹0 |
| **DeepSeek-V4-Flash-0731** | Writes `tagline` (≤24 chars) and `about` (≤160 chars), only if missing in DB | ~250ms | ~₹0.001 (10,000 sites ≈ ₹10) |

*DeepSeek pricing: $0.06/M input, $0.18/M output, $0.015/M cached.*

---

## 2. Page Spine + Tokenized Sections

**Problems:**
- **Whole static pages** are too rigid: a 50-item restaurant and a 3-item bakery need different sections.
- **Random section mixing** causes mismatched fonts, colors and margins ("template soup").

**Solution:** one page spine (`spine.js`) locks in the `DESIGN.md` colors, fonts, max-width and alternating background bands (`canvas → band-1 → canvas → band-2`). Jev slots an ordered list of token-pure sections into it.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PAGE SPINE (spine.js)                                                   │
│ Injects styles/sweetgreen.json CSS variables (:root) & band rhythm      │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. NAV      sections/nav/centered-pill.js      (on --bg-canvas)   │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ 2. HERO     sections/hero/bleed-overlay.js     (on --bg-canvas)   │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ 3. CATALOG  sections/catalog/photo-grid.js     (on --bg-band-1)   │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ 4. STORY    sections/story/split-editorial.js  (on --bg-canvas)   │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ 5. FOOTER   sections/footer/hours-map.js       (on --bg-band-2)   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Rule:** no section file hardcodes colors, fonts or radii. Each one reads the CSS variables from `styles/{styleId}.json` (`--bg-canvas`, `--accent-fill`, `--font-display`, `--radius-card`).

---

## 3. The Section Library (6 types × 3–4 variants)

About **18 small section files (~50 lines each)** combine with **500 `DESIGN.md` styles** into thousands of distinct sites.

| Section Type | Variants Jev Can Pick | Auto-Safety Rule (in `spine.js`) |
|---|---|---|
| **1. `nav`** | `centered-pill` (Sweetgreen) · `minimal-left` (Mollie) · `bold-bar` | Always shown |
| **2. `hero`** | `bleed-overlay` · `split-editorial` · `packshot-stage` · `kinetic-poster` | If `photos == 0`, use `kinetic-poster` (large type, no empty image box) |
| **3. `catalog`** | `photo-grid` · `menu-sheet` (text price list) · `bordered-cells` · `elevated-tiles` | If `itemPhotos == 0`, use `menu-sheet` (no blank grey squares) |
| **4. `story`** | `split-photo-text` · `big-quote-band` · `highlight-pillars` | Hidden if `about` is empty |
| **5. `gallery`** | `bento-mosaic` · `horizontal-reel` | Hidden unless merchant has ≥ 3 photos |
| **6. `footer`** | `hours-map-card` · `minimal-whatsapp-bar` | Hours table hidden if `hours` is empty |

---

## 4. How `DESIGN.md` Becomes a Style (`ingest.ts` → `styles/*.json`)

`ingest.ts` runs **once, on our machine**, turning each Refero `DESIGN.md` into a JSON style:

```
designmds/DESIGN.md (Sweetgreen, 420 lines)
        │
        ▼  ingest.ts
styles/sweetgreen.json
  ├── 1. JEV TAGS          { nature: "food", vibe: "farm-stand warm organic salad" }
  ├── 2. 18 CSS VARIABLES  Colors (#f4f3e7 cream, #e6ff55 lime), fonts, sizes, radii
  └── 3. DEFAULT SECTIONS  The brand's signature variants from DESIGN.md:
                           {
                             nav: "centered-pill",
                             hero: "bleed-overlay",
                             catalog: "photo-grid",
                             story: "split-photo-text"
                           }
```

---

## 5. Mode 1 End-to-End Flow (site live in < 0.5s)

Mode 1 is fully standalone.

```
Merchant input: "artisan sourdough bakery, pre-orders on WhatsApp"
Workspace DB:   18 items (no item photos yet), 2 shop photos, hours set
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: JEV (1 fast call, ~50ms)                                           │
│  • Picks style:  styleId = "sweetgreen" (its default stack)                │
│  • Adapts stack: 0 item photos -> catalog swaps to "menu-sheet"            │
│  • Final stack:  nav:centered-pill · hero:bleed-overlay                    │
│                  catalog:menu-sheet · story:split-photo-text               │
│                  footer:hours-map-card                                     │
└───────┬────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: DeepSeek-V4-Flash-0731 (~250ms, only if copy is empty)             │
│  • tagline: "SLOW FERMENTED DAILY." (≤ 24 chars)                           │
│  • about:   "Small-batch naturally leavened loaves..." (≤ 160 chars)       │
└───────┬────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: SAVE & RENDER (<1ms)                                               │
│  • Saves { styleId, sections[], tagline, about } to Workspace DB           │
│  • Server renders: spine.render(clamp(dbData), styles[styleId], sections)  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Automated Browser Gate (`gate.ts`)

Every section lives in a horizontal band of `spine.js`, so we test the variants themselves rather than every combination. All 18 section variants are stacked on one page for each `style.json` and checked in Playwright at **375px (phone)** and **1280px (desktop)**:

| Check | Rule Verified by Playwright |
|---|---|
| **1. No overflow** | `document.documentElement.scrollWidth <= window.innerWidth` at both widths |
| **2. No overlap** | Text and buttons never collide at max lengths (24-char tagline, 160-char about) |
| **3. No empty boxes** | With 0 photos in DB, hero and catalog render typography-only variants |
| **4. Data is real** | Item prices (e.g. ₹249) and WhatsApp order links from the DB appear in the rendered HTML |

---

## 7. Mode 2: Custom Agent Builder (future)

For merchants who want a section that isn't in `sections/` (e.g. "match this screenshot"):

```
Screenshot / prompt ──► Coding agent writes a custom section using the merchant's style.json tokens ──► gate.ts ──► Live
```

---

## Summary: What We Build Now (7 Small Pieces)

```
project/
├── ingest.ts     (Refero DESIGN.md ──► styles/*.json)
├── styles/       (Brand style JSON: sweetgreen.json, mollie.json, ...)
├── spine.js      (60-line page wrapper: CSS tokens + alternating section bands)
├── sections/     (6 folders: nav/, hero/, catalog/, story/, gallery/, footer/)
├── clamp.ts      (Trims DB text to safe lengths so layouts never break)
├── pick.ts       (Mode 1: Jev picks styleId + sections[]; DeepSeek writes copy)
└── gate.ts       (Playwright check at 375px and 1280px)
```
