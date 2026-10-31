# Site Builder

## The whole thing

```
items + prices + photos  +  section stack  +  style  =  site doc
(one room snapshot)         (Jev or a prompt)  (styles/*.json)
```

One doc, one renderer, one deploy. A store is a subdomain plus a doc, never an artifact.

## 1. Two modes, one output

| mode | who | gets |
| :--- | :--- | :--- |
| 1 | Jev picks `styleId` + stack; DeepSeek writes `tagline` (24) and `about` (160) | a doc of existing variants |
| 2 | Pi in the room: words or screenshot -> doc, or a new variant | the same doc |

Same confirm, same publish, same pointer. Mode 2 adds one thing: the vocabulary can grow. Mode 1 cannot.
No model on a view. Models run while a doc is drafted, never while a page is served.

## 2. The flow

```
 MODE 1                           MODE 2
 words                            words / screenshot
   |                              |
   v                              v
 Jev: style + stack               Pi harness in the room
 DeepSeek: tagline, about         (state in SQLite)
   |                              |
   |                              +-- can say it --> edit doc
   |                              |
   |                              +-- cannot --> new variant
   |                                             |
   |                                             CI: gate 375/1280
   |                                             |
   |                                             platform release
   |                                             (all stores)
   |                                             |
   +--------------------+------------------------+
                        |
                        v
                    site doc
                        |
                   [ confirm ]
                        |
                        v
         publish: validate -> render.ts
                        |
                        v
      R2: <slug>/<release>.html (immutable)
                        |
                        v
      live.json repoints (the only pointer)
                        |
                        v
*.tar.site -> slug -> live.json -> release -> CDN
order -> room: order.create (price + stock at truth)
```

## 3. Spine

One `spine.js`: injects the style's CSS variables, sets the max width, alternates
`canvas -> band-1 -> canvas -> band-2`. Sections slot in, token-pure.

A section never hardcodes a color, font or radius. It reads variables only:
`--bg-canvas`, `--accent-fill`, `--font-display`, `--radius-card`.

## 4. Sections - 6 types, 18 files

| type | variants | auto rule |
| :--- | :--- | :--- |
| nav | centered-pill, minimal-left, bold-bar | always |
| hero | bleed-overlay, split-editorial, packshot-stage, kinetic-poster | 0 photos -> kinetic-poster |
| catalog | photo-grid, menu-sheet, bordered-cells, elevated-tiles | 0 item photos -> menu-sheet |
| story | split-photo-text, big-quote-band, highlight-pillars | hide if about is empty |
| gallery | bento-mosaic, horizontal-reel | hide under 3 photos |
| footer | hours-map-card, minimal-whatsapp-bar | hide hours if empty |

18 files and 500 styles give thousands of sites, with no code per merchant.

## 5. Styles - ingest once

`ingest.ts` runs once, on our machine, and turns each Refero `DESIGN.md` into
`styles/<id>.json`: Jev tags (nature, vibe), 18 CSS variables, and the brand's
default stack. A draft starts from that stack and changes only what the data forces.

## 6. Data - all items

| what | where |
| :--- | :--- |
| items, prices | item rows in the room |
| photos | R2; the item holds the url |
| hours, tagline, about | the site item |
| site doc | one item: styleId, sections[], copy, version |
| release | R2: `<slug>/<release>.html` + one release move |
| live.json | the pointer |

No site tables.

## 7. Publish

```
[ confirm ] -> validate the doc (pure, <1 ms)
            -> render.ts(doc, snapshot) -> R2: <slug>/<release>.html
            -> one release move { key, at, by }
            -> live.json repoints
            -> CDN serves, cache keyed by release
```

- A release is immutable. Publish writes a new one; rollback repoints.
- No compile, no bundle, no sandbox. `render.ts` is our code; the doc is data.
- Serving is static, so the room is not in the request path: no actor wake, no region problem.
- A custom domain is the same pointer behind another hostname.
- Preview renders the draft doc to the app; publish writes it to R2.
- Editing a doc changes nothing until publish.

## 8. Storefront orders

A visitor is not a member. Each release carries one public token that allows
exactly `order.create`, rate-limited, no money. The page is a snapshot; the order
re-reads price and stock in the room and refuses a stale price. The order lands
pending to pack; payment lands later through the payment adapter.

## 9. Gate

Two gates, not one.

| when | what | cost |
| :--- | :--- | :--- |
| every publish | schema, enum, token whitelist, text length, empty sections | <1 ms, no browser |
| every renderer or variant release | Playwright 375/1280 on all variants and default stacks, style lint | minutes, once |

| check | rule |
| :--- | :--- |
| overflow | `scrollWidth <= innerWidth` |
| overlap | max tagline/about never collide |
| empty boxes | 0 photos renders a type-only variant |
| data truth | a real price and the WhatsApp link appear |
| style lint | contrast, spacing and type scale follow the style file |

Per-store publish never runs a browser, which is why no sandbox sits in the path.

## 10. Mode 2 - later

Ask runs on Pi Durable: one harness per room, its state in the room's SQLite.
The same conversation builds the site. No second app, no second actor.

```
prompt -> Pi harness in the room
       -> library can say it?  yes -> edit the doc -> publish
                              no  -> propose one new variant
                                     -> CI only: build + gate.ts
                                     -> platform release: all stores
                                     -> the doc may use it -> publish
```

- Pi's steps live in harness state, checkpointed, so a crash resumes mid-turn.
- `requestId` per turn; publish is idempotent by release id, only after confirm.
- the ledger stays clean: one site item and one release move, never a step.
- keys and the DB stay in the room; CI sees code, never keys or data.
- a prompt never edits a live store's code. A missing visual grows the library, for everyone.
- beta: pin the version behind one `architect` interface.
- taste is a style file plus lint, never a model on run.
- the public token is per release and allows only `order.create`.
- no store actor per site, no KV database. the slug points at live.json.

## Files

```
ingest.ts    DESIGN.md -> styles/*.json
styles/      brand json
spine.js     the page shell
sections/    6 folders, 18 files
doc.ts       site doc schema + validate
render.ts    doc + snapshot -> HTML; the one renderer
pick.ts      mode 1: Jev picks, DeepSeek writes copy
architect.ts mode 2: Pi proposes a doc or a new variant
gate.ts      Playwright + style lint, at release
```
