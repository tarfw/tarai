# Pizza Corner — sample storefront

A Mode 1 (CURATED) sample site for TAR's `site` tool: one page, menu
from data, INR prices, WhatsApp ordering. No checkout, no payment — the
page shows looks and prices only, per the site law in `../tarfw.md`.

## Built with tasteskill v2

Direction `page-is-the-object` (seed 1712607498): the shop's stationery
is the site — striped awning card beside the oven photograph, a scalloped
printed menu sheet, a kitchen order slip (the live thing: tap menu rows,
the slip totals with GST and hands the order to WhatsApp), an itinerary
receipt, a visit card on the Chennai street, and the back of the card as
footer. Type: Libre Franklin 700 / Source Serif 4 (self-hosted).
Palette: dark brand variant (near-black ground, red accent, deep blue field; white paper stationery). Five found photographs, credited in the footer.
Run notes and critique: `.taste-skill/notes.md`.

## Run

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview
```

## Structure

- `src/data/menu.ts` — the single source of truth (menu, offers, hours,
  address, WhatsApp number). Swapping this file is what a merchant edit
  would do; the layout never changes.
- `src/components/` — one component per band of the page.
- `src/pages/index.astro` — the only page. One door.

## As a release

`npm run build` produces a fully static `dist/`. In the TAR flow this
folder is the immutable release uploaded to the SITE_RELEASES R2 bucket
and served by the shared sites worker (`../sites/`) at
`pizza.tar.site` (or `tar-sites.tar-54d.workers.dev/<workspace>/` until
the wildcard domain is on).

Placeholder values to swap before any real use: WhatsApp number, phone,
address, prices.
