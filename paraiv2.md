# Site Builder Tool — Zero-Complexity Plan

```
SITE  =  render(clamp(data)) -> HTML
TOOL  =  Mode 1 (Instant Pick)  +  Mode 2 (Agent Studio)  +  4-Fixture Gate
```

```
Merchant Words ──► [ MODE 1: Jev + Tiny LLM (<0.5s) ] ──► library/{id}.js ──┐
                                                                            ├──► render(clamp(data)) ──► LIVE SITE (<1ms)
Screenshot/Edit ─► [ MODE 2: Studio Agent (~2 min)  ] ──► custom/{id}.js  ──┘
                                │
                        [ 4-FIXTURE GATE ] (375px + 1280px, 0 FAIL)
```

---

## 1. Data Contract (`clamp.ts`)

```
RAW DB  ──►  clamp(raw)  ──►  SAFE DATA  ──►  render(data)
(AI never touches prices, items, or WhatsApp links)
```

| Field | Limit / Rule | Source |
|---|---|---|
| `brand.name` | `<= 40 chars` | Merchant DB |
| `brand.tagline` | `<= 24 chars` | Merchant DB or Mode 1 Tiny LLM |
| `brand.about` | `<= 160 chars` | Merchant DB or Mode 1 Tiny LLM |
| `contact` | `{ whatsapp, address?, mapUrl? }` | Merchant DB |
| `hours[]` | `{ day, open, close }` | Merchant DB |
| `photos[]` | `{ url, cutout? }` (broken URLs dropped) | Merchant DB |
| `items[]` | `{ name, price, category?, photo? }` | Merchant DB |

---

## 2. Two Modes (`pick.ts` + `build.ts`)

```
MODE 1 (99% — Instant, ~Rs 0.05)
  words ──► JEV (picks themeId from index.json)
        └──► TINY LLM (writes tagline + about ONLY if missing)
        └──► DONE (renders in <1ms from library/{themeId}.js)

MODE 2 (1% — Custom Studio, ~2 min)
  screenshot / prompt ──► AGENT writes render(data) ──► GATE (0 FAIL) ──► custom/{merchantId}.js
                                                                      └──► copy to library/ (optional harvest)
```

| | Mode 1: Instant Pick | Mode 2: Agent Studio |
|---|---|---|
| **Model** | **Jev** (pick `themeId`) + **Tiny LLM** (copy fallback) | Coding Agent (writes `render.js`) |
| **Speed / Cost** | `< 0.5s` / `~₹0.05` once | `~2 min` / `~₹5` per build |
| **Browser Gate?** | No (library theme is already pre-gated) | Yes (`gate.ts` runs before save) |
| **Output** | Points merchant to `library/{themeId}.js` | Writes `custom/{merchantId}.js` |

---

## 3. Pre-Built Library (Framer / Webflow / Shopify Quality)

### Formula for Agency Quality
```
PRO THEME  =  Real Reference Tokens  +  Whole-Page Archetype  +  3 Hero States  +  core.css (3KB)
```

### A. How Library Themes Are Built Offline (`harvest.ts`)
Never ask an LLM to "imagine a website". Distill real award-winning sites (Framer, Godly, Shopify):

```
Reference URL / Screenshot
   │
   ├─► 1. EXTRACT   Playwright grabs screenshot + computed styles (fonts, clamp() scale, grid gaps, colors)
   ├─► 2. DISTILL   Agent rebuilds layout as pure render(data) + 3 Hero States + core.css
   ├─► 3. GATE      Must pass 4 Stress Fixtures (375px & 1280px) + Visual Diff = 0 FAIL
   └─► 4. INDEX     Saved to library/{id}.js + tagged in library/index.json for Jev
```

### B. Inside Every `render(data)` — Adaptive `if` Rules (Zero Empty Boxes)
Every theme adapts automatically as merchant data changes—no JSON DSL needed:

```
HERO      =  if (cutoutPhoto)  -> Packshot Stage (floating cutout over giant type)
             else if (photo)   -> Editorial Bleed (framed photo + glass CTA)
             else              -> Kinetic Poster (Framer-style giant typography, 0 photos needed)

SECTIONS  =  if (photos >= 3)  -> Gallery Grid
          +  if (items  >= 1)  -> Sticky Category Pills + Menu/Catalog Sheet
          +  if (hours  >= 1)  -> Hours & Location Footer
```

### C. Shared Polish Core (`core.css` = 3KB, used by all themes)
```
core.css  =  Fluid Type (clamp)  +  Tabular Prices (tabular-nums)
          +  Sticky Scroll-Snap Category Bar  +  Floating WhatsApp Order Bar
```

### D. Starting Shelf (`library/index.json` = 12 Master Themes)

| Nature | Theme 1 (Editorial) | Theme 2 (Bold / Kinetic) | Theme 3 (Visual / Grid) |
|---|---|---|---|
| **Food / Cafe** | `editorial-menu` (Aesop/bakery) | `kinetic-street` (poster type) | `packshot-bento` (fast-casual) |
| **Retail / D2C** | `shopify-atelier` (luxury) | `split-lookbook` (sticky left hero) | `grid-catalog` (dense shop) |
| **Services** | `framer-mono` (studio/salon) | `bold-booking` (fitness/agency) | `warm-craft` (clinic/tutor) |
| **General** | `swiss-directory` (tabular) | `minimal-card` (1-screen bio+) | `card-market` (local store) |

---

## 4. The 4-Fixture Browser Gate (`gate.ts`)

Runs **once per theme** (in CI for `library/` or in Mode 2 for `custom/`). Never needed on Mode 1 merchant birth.

```
render(fixture)  x  4 Fixtures  x  2 Viewports (375px, 1280px)  ──►  Playwright Check  ──►  0 FAIL
```

| Fixture | Input Data | Must Pass |
|---|---|---|
| **1. Bare** | `0 photos, 1 item, no hours` | Hero switches to Kinetic Poster; 0 empty boxes |
| **2. Rich** | `8 photos + cutouts, 40 items, 5 categories` | Category bar scrolls; grid aligns cleanly |
| **3. Stress** | `24ch tagline, 160ch about, 60ch item names` | `scrollWidth <= innerWidth` (0 overflow, 0 overlap) |
| **4. Truth** | `Sentinel prices (₹999) + WhatsApp link` | Exact prices & CTA links present in DOM |

---

## 5. Whole Tool = 5 Files (~250 LOC)

| File | Role | LOC |
|---|---|---|
| `core.css` | Shared fluid typography, tabular prices, sticky pills, WhatsApp bar | ~60 |
| `clamp.ts` | Sanitizes DB row into safe `Data` (`<=24ch`, `<=160ch`, valid URLs) | ~30 |
| `gate.ts` | Playwright runner: 4 fixtures × 2 viewports = 0 overflow / 0 overlap | ~80 |
| `pick.ts` | **Mode 1:** Jev picks `themeId` + Tiny LLM fallback for `tagline`/`about` | ~30 |
| `build.ts` | **Mode 2 & Harvester:** Extracts reference styles → writes `render.js` → runs `gate.ts` | ~50 |
