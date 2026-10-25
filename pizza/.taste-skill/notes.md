# Pizza Corner — run notes (tasteskill v2)

Direction: `page-is-the-object` · seed 1712607498 · sector restaurant.
Type: Libre Franklin 700 / Source Serif 4. Palette: Three stones.
Hero: striped card beside the room. Motion: slow crossfade.

## Inventory (what only this shop has)

- The oven is lit at 4 pm sharp; stone hits 400 °C by six.
- Bazaar Street, opposite the flower market, Chennai 600001.
- Dough proofed overnight, stretched by hand; never yesterday's.
- Delivery radius 2 km, promise 30 minutes, one rider one box.
- WhatsApp is the ordering channel; UPI or cash at the door.
- Veg / non-veg square-dot marks; GST 5%; 10″ standard, 14″ +₹120.
- Mondays closed — "the dough rests."
- Closed Tue–Sun 11:00–22:30.

## Argument (claim → section)

1. Real wood fire, a daily ritual → hero card + intro facts row.
2. The whole menu, priced, nothing hidden → the printed menu sheet.
3. Ordering is one message; here is the journey → itinerary slip
   (and the live order slip rides with the menu).
4. Find us on Bazaar Street → visit card on the street photograph.
5. The back of the card closes → footer.

## Idea sentence

On this page, **the shop's own stationery — the wall menu, the kitchen
order slip, the visit card — becomes the whole site**: the menu is a
printed sheet, ordering fills a slip, and sending hands the slip to
WhatsApp. (Competitor test: the bakery two streets away sells bread;
this device is this shop's actual paper and its actual ordering door.)

## Live thing

The order slip: tap menu rows, the slip fills (qty × item, ₹ subtotal,
GST 5%, total); Send opens WhatsApp with the order typed. Phone: a
bottom bar with the total that expands. Without script every row is
still a wa.me link ordering that one item; nothing blocks reading.

## Copy deck (headline arithmetic)

- Hero h1 (serif, 2 lines, 13/14 chars): "Lit at four." / "Eaten by nine."
- Hero support: "Wood-fired pizzas on Bazaar Street, Chennai.
  Order on WhatsApp and it's at your door in thirty minutes."
- Intro heading: "The oven decides." Note (3 lines) + facts:
  400 °C · 30 min · 2 km · ₹149.
- Menu sheet: "The evening menu" + GST/size note + 13 items + hours foot.
- How it arrives: itinerary rows 0/3/4/20 min, inverted final
  "Hot pizza at your door — 30 min".
- Visit card: address, hours, phone, WhatsApp button.
- Footer: "Come hungry." + message + link block + credits.

## Pictures (all found, all credited on the page)

1. assets/chef-oven.jpg — chef with the peel (crop of "Commercial Wood
   Fired Pizza Ovens", Sahiludiawar, CC BY-SA 4.0, Wikimedia) — hero 1.
2. assets/brick-oven.jpg — "Brick Oven", basheertome, CC BY 2.0, Flickr — hero 2.
3. assets/margherita-originale.jpg — "Margherita Originale", Mario56,
   CC BY-SA 3.0, Wikimedia — hero 3 + footer stamp.
4. assets/terracotta-statur-woman-kneading-dough-5th-century.jpg — Greek
   terracotta baker, 5th c. BC, MatthiasKabel, CC BY-SA 3.0 — intro.
5. assets/diwali-urban-shopping-thiyagaraja-nagar-chennai.jpg — Chennai
   shopping street, Arunsarv, CC BY-SA 4.0 — visit ground.

Video: no honest clip found; the crossfade + drift is the moving picture.
Sample content to swap before launch: WhatsApp number, phone, address, prices.

## Critique (references/critique.md shape)

Round 1 (desktop fold / menu page / mobile fold):
- Hero: couplet competed with the name; links cramped; green accent reads
  "eco" (kept: dealt palette). Fixed the first two.
- Menu: rows cramped; empty slip a dead zone; Clear link orphaned.
  Fixed all three (air in rows; italic empty state with presence,
  controls appear only with items).
- Mobile: card modest; chef's head clipped by the overlap. Bolder type
  scale; crop raised (flames are the subject; overlap kept).

Round 2: all three screens read finished. Remaining notes, accepted:
accent is the dealt Three-stones grey-green; 12px phone margin is the
dealt hero blueprint's own frame.

Inspector: before 9 FAIL / 7 WARN → final 0 FAIL / 3 WARN, all three
defended above (size-count: dealt clamps sample 10 sizes at 1440;
no-footage: assets.mjs --video found nothing usable for this subject —
the crossfade + drift is the moving picture; edge-text 390: blueprint
margin). Live thing verified headless: 1× Margherita + 2× Chicken
tikka → ₹807 + GST ₹40 = ₹847, WhatsApp message composed, phone bar
active. lint.mjs: 0 FAIL / 0 WARN.

## Brand variant: dark, Domino's-like (round 3)

Constraint (user): dark, colourful, national-chain energy. draw.mjs
--redraw palette dealt "Rose grey, green" — still quiet, contradicting
the constraint, so per the sheet's own rule the dealt PROPORTIONS were
kept (one ground, one ink, one accent, one field) and the colours taken
from the brand world: ground #14161a, paper #ffffff (the artefacts stay
paper), light ink #f4f4f2, accent red #d92c20, field blue #0f4f79.
Type and composition unchanged from the dealt sheet.

Two real defects found and fixed during the gate:
1. global h1-h3 colour rule beat the paper inheritance → 1:1 headings
   on paper (inspector FAIL contrast). Headings now inherit.
2. warm paper (#f7f4ee/#fafaf7) tripped the palette-cream WARN; pure
   white paper + neutral light ink cleared it.

Bugs this exposed in the earlier light build's CSS: shorthand padding
on section roots overriding .frame side padding (fixed earlier round);
slip stepper buttons surface-on-surface (fixed to #e7e2d8).

Gate: lint 0 FAIL / 0 WARN · inspector 0 FAIL / 3 WARN (the same three
defended: dealt type scale, no honest footage, blueprint phone margin).
Screenshots reviewed at 1440/390: fold, menu band, how slip, visit,
footer all read branded and coherent. Live thing re-verified headless:
1× Margherita + 2× Chicken tikka → ₹807 + ₹40 GST = ₹847.

## Complete redesign: one-motif (round 4)

Direction: `one-motif`, seed 1347550932. Chosen from three dealt
(over place-carries-it: our best pictures are oven close-ups, not
"where you stand" views; over uneven-photographs: dealt twice already,
calmer than the subject). The motif: the arch of the oven mouth.

Idea: "On this page, the arch of the 400 °C oven mouth becomes every
shape — the hero is an arch-window onto the fire, every button is an
arch, every photograph is seen through one, the menu bullets are arches,
the coupon is notched and perforated, the accordion climbs a tint
ladder, and the footer builds PIZZA CORNER as knocked-out blocks."

Type: Schibsted Grotesk 400/600/800, self-hosted. Palette: dealt
Blush/sage/slate, adopted as dealt (no redraw). Accordion tints: one
hue, dark to light.

Redraws, with reasons:
- list photo-bullets: honest photographs exist for one dish only;
  13 arch-shaped flat bullets in the dealt blush instead (asset does
  not exist; one dish's photo must not stand for thirteen).
- contact coupon inputs: a fake order form is banned (no checkout
  without a backend); the dealt coupon geometry carries the live order
  slip instead — clip-out notches, perforation, Send bar as the submit.

Defects found by the gate, fixed: shutter clipped itself to nothing and
could never intersect (observe the hero, open accordion shutters on
click); footer small button colour lost to a more specific selector;
tint-3 too dark for dark ink; menu descriptions set in soft grey.

Gate: lint 0 FAIL / 0 WARN · inspector 0 FAIL / 3 WARN (dealt type
scale, no honest footage exists, muted secondary notes). Screenshots
reviewed at 1440 + 390 (fold, menu, accordion, coupon, footer, mobile).
Live thing re-verified headless: 1× Margherita + 2× Breadsticks →
₹364, WhatsApp message composed, accordion switch + shutter fire,
phone bar active. Before-record: .taste-skill/redesign-before (+ src
snapshot at redesign-before-src).
