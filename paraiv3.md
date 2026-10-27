# Site Builder — Complete, Simple Plan

## The Big Picture (In One Equation)

A merchant's website is assembled in **<1ms** by combining **3 clean pieces**:

```
   1. MERCHANT DATA             2. SECTION STACK                3. BRAND STYLE (from DESIGN.md)
(Items, Prices, Photos)   +   (Ordered list of Sections)   +   (Colors, Fonts, Radii, Spacing)   =   LIVE WEBSITE
  from Workspace DB             picked by Jev from sections/     from styles/*.json (Refero)
```

---

## 1. Model Choice for Mode 1

```
MODE 1 BRAIN  =  JEV (Picks Style + Section Stack)  +  DeepSeek-V4-Flash-0731 (Writes Short Copy)
```

| Model | Job in Mode 1 | Speed | Cost per Site |
|---|---|---|---|
| **Jev** | Picks `styleId` + ordered `sections[]` list based on merchant words & DB stats | `~50ms` | Near ₹0 |
| **DeepSeek-V4-Flash-0731** (`$0.06/M in, $0.18/M out, $0.015/M cached`) | Writes `tagline` (≤24 chars) + `about` (≤160 chars) **only** if missing in DB | `~250ms` | **$0.000012 (~₹0.001)** *(10,000 sites = ₹10!)* |

---

## 2. Page vs. Sections: The "Page Spine + Tokenized Sections" Architecture

**Problem with Whole Static Pages:** Too rigid—a 50-item restaurant and a 3-item bakery need different sections.
**Problem with Random Lego Sections:** Mismatched fonts/colors/margins ("template soup").

**The Best Solution — Page Spine + Token-Pure Sections (How Shopify OS & Framer work):**
We use **1 Page Spine (`spine.js`)** that locks in the `DESIGN.md` colors, fonts, max-width, and alternating background bands (`canvas → band-1 → canvas → band-2`), and slots in an **ordered list of Token-Pure Sections** picked by Jev:

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

**Why this never looks like "template soup":**
Every section file in `sections/` is **forbidden** from hardcoding its own colors, fonts, or corner radii. It **must** use the CSS variables from `styles/{styleId}.json` (`--bg-canvas`, `--accent-fill`, `--font-display`, `--radius-card`).

---

## 3. The Section Library (`sections/` = 6 Types × 3–4 Variants)

We only maintain **~18 small section files (~50 lines each)**, yet combined with **500 `DESIGN.md` styles**, they produce **thousands of distinct world-class sites**:

| Section Type | Variants Available for Jev to Pick | Auto-Safety Rule (in `spine.js`) |
|---|---|---|
| **1. `nav`** | `centered-pill` (Sweetgreen) · `minimal-left` (Mollie) · `bold-bar` | Always shown |
| **2. `hero`** | `bleed-overlay` · `split-editorial` · `packshot-stage` · `kinetic-poster` | If `photos == 0`, auto-switches to `kinetic-poster` (giant Framer typography, no empty image box!) |
| **3. `catalog`** | `photo-grid` (cards with photos) · `menu-sheet` (text price list) · `bordered-cells` · `elevated-tiles` | If `itemPhotos == 0`, auto-switches to `menu-sheet` so there are never blank gray squares |
| **4. `story`** | `split-photo-text` · `big-quote-band` · `highlight-pillars` | Hidden if `about` text is empty |
| **5. `gallery`** | `bento-mosaic` · `horizontal-reel` | Hidden unless merchant has `>= 3 photos` |
| **6. `footer`** | `hours-map-card` · `minimal-whatsapp-bar` | Hides hours table if `hours` is empty |

---

## 4. How `DESIGN.md` Files Are Converted (`ingest.ts` → `styles/*.json`)

We run `ingest.ts` **once on our computer** to turn Refero `DESIGN.md` files (like Sweetgreen) into clean JSON files:

```
designmds/DESIGN.md (Sweetgreen — 420 lines)
        │
        ▼  ingest.ts
styles/sweetgreen.json
  ├── 1. JEV TAGS          { nature: "food", vibe: "farm-stand warm organic salad" }
  ├── 2. 18 CSS VARIABLES  Colors (#f4f3e7 cream, #e6ff55 lime), Fonts, Sizes, Radii
  └── 3. DEFAULT SECTIONS  The brand's signature section variants from DESIGN.md:
                           { nav: "centered-pill", hero: "bleed-overlay", catalog: "photo-grid", story: "split-photo-text" }
```

---

## 5. Mode 1 End-to-End Flow (How a Site is Born in <0.5s)

Mode 1 is **100% standalone** and produces the complete live website:

```
Merchant Input: "artisan sourdough bakery, pre-orders on WhatsApp"
Workspace DB:   18 items (no item photos yet), 2 shop photos, hours set
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: JEV (1 fast call, ~50ms)                                           │
│  • Picks Style:    styleId = "sweetgreen" (starts with its default stack)  │
│  • Adapts Stack:   Sees 0 item photos -> swaps catalog to "menu-sheet"     │
│  • Final Stack:    ["nav:centered-pill", "hero:bleed-overlay",             │
│                     "catalog:menu-sheet", "story:split-photo-text",        │
│                     "footer:hours-map-card"]                               │
└───────┬────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: DeepSeek-V4-Flash-0731 (~250ms, ~₹0.001 — ONLY if copy is empty)   │
│  • Writes tagline: "SLOW FERMENTED DAILY." (<= 24 chars)                   │
│  • Writes about:   "Small-batch naturally leavened loaves..." (<= 160 ch)  │
└───────┬────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: SAVE & RENDER (<1ms, ₹0 forever)                                   │
│  • Saves { styleId, sections[], tagline, about } to Workspace DB           │
│  • Server renders: spine.render(clamp(dbData), styles[styleId], sections)  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Automated Browser Gate (`gate.ts`)

Because every section lives inside a horizontal band in `spine.js`, we don't need to test millions of combinations.
We test **all 18 section variants stacked on one page × each `style.json`** in Playwright at **375px (Phone)** and **1280px (Desktop)**:

| Check | Rule Verified by Playwright |
|---|---|
| **1. Zero Overflow** | `document.documentElement.scrollWidth <= window.innerWidth` on Phone & Desktop |
| **2. Zero Overlap** | Text and buttons never collide at max text lengths (`24ch` tagline, `160ch` about) |
| **3. Zero Empty Boxes** | With `0 photos` in DB, hero & catalog cleanly render typography-only variants |
| **4. 100% Data Truth** | Real item prices (`₹249`) and WhatsApp order links from DB exist in the rendered HTML |

---

## 7. Mode 2 — Custom Agent Builder (Future Feature)

Built later when a merchant wants a custom section that isn't in `sections/` (*"match this screenshot"*):
```
Screenshot / Prompt ──► Coding Agent writes custom section using merchant's style.json tokens ──► gate.ts ──► Live
```

---

## Summary: What We Build Now (5 Small Pieces)

```
project/
├── ingest.ts          (Converts Refero DESIGN.md files ──► styles/*.json)
├── styles/            (Folder of JSON brand styles: sweetgreen.json, mollie.json, ...)
├── spine.js           (60-line page wrapper: injects CSS tokens + alternates section bands)
├── sections/          (6 folders: nav/, hero/, catalog/, story/, gallery/, footer/)
├── clamp.ts           (Trims DB text to safe lengths so layouts never break)
├── pick.ts            (Mode 1: Jev picks styleId + sections[], DeepSeek-V4-Flash writes copy)
└── gate.ts            (Playwright browser check at 375px & 1280px)
```
