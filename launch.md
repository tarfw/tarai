# TAR — Launch Plan

## Idea

TAR = online store + WhatsApp orders for small shops.
Merchant keeps cash / UPI QR / COD at the counter.
Rule: no spending until revenue pays for it.

## Summary

- Who pays = shop owners, Tamil Nadu
- They get = store, WhatsApp orders, sales, stock, Jev
- Cost to them = Free, ₹500/month, or ₹4,999/year
- Our cost = only what paying merchants bring in

## Market

- Tamil Nadu = ~7.7 crore people, ~30 lakh selling merchants
- Shop owners = phone only, Tamil
- WhatsApp India = 500M+ users

## Who

| Segment | Plan |
| --- | --- |
| Home business | Free |
| Small shop | Free, then yearly |
| Medium shop | Yearly + direct help |
| Chains (2-10 branches) | Yearly per branch |

## Merchant needs

- Cheap Android, slow internet
- Simple Tamil, no tech words
- Counter unchanged
- One task in 30 seconds
- One-tap undo
- Festival offers before Deepavali

## WhatsApp ordering

Channel flow, design and costs: see [social.md](social.md).

## Pricing

| Plan | Price | Note |
| --- | --- | --- |
| Free | ₹0 | store + wa.me, 20 products |
| **Yearly (main)** | **₹4,999/yr** | ≈₹417/mo, 2 months free |
| Quarterly | ₹1,399 | fewer visits |
| Monthly | ₹500 | no contract |
| Founding 100 | ₹299/mo for life | first 100 only |
| WhatsApp add-on | +₹100/mo (₹600 total) | own number on WhatsApp API; see Credits below |
| Commission (Home, Small) | ₹100/mo + 1% of TAR orders | subscription funds the wallet; see Plan C |

### Cards

**Yearly (main)**

```text
┌────────────────────────────────────┐
│ YEARLY (MAIN)            ₹4,999/yr │
│ About ₹417/month                   │
│ Two months free                    │
│ Prepaid, no autopay push           │
└────────────────────────────────────┘
```

**Monthly**

```text
┌────────────────────────────────────┐
│ MONTHLY                       ₹500 │
│ No contract                        │
│ Everything included                │
└────────────────────────────────────┘
```

**Quarterly**

```text
┌────────────────────────────────────┐
│ QUARTERLY                   ₹1,399 │
│ Fewer collection visits            │
└────────────────────────────────────┘
```

**Founding 100**

```text
┌────────────────────────────────────┐
│ FOUNDING 100               ₹299/mo │
│ First 100 merchants, for life      │
└────────────────────────────────────┘
```

**Free**

```text
┌────────────────────────────────────┐
│ FREE                            ₹0 │
│ Store + wa.me orders               │
│ 20 products, TAR badge             │
└────────────────────────────────────┘
```

**WhatsApp add-on**

```text
┌────────────────────────────────────┐
│ + WHATSAPP ADD-ON         +₹100/mo │
│ Own number on WhatsApp API         │
│ Total with base: ₹600              │
│ Or: 350 credits/month from wallet  │
└────────────────────────────────────┘
```

- Why ₹500 = billing app ₹500-1,500 for one feature; Shopify ₹1,994 for store only. TAR = all of it. One extra order a day covers it.
- Quote = "₹4,999 a year, two months free, like your AC service."
- No setup fee. No lifetime deals. Autopay offered, never pushed.
- Test (Chennai, 90 days) = ₹4,999 vs ₹3,999 vs ₹5,999 by street. Winner = most cash collected.

### Credits (prepaid wallet)

Additional layer. Plans above still set the price; credits are how the money is held and spent.

- 1 credit = ₹1. Prepaid by UPI. No card, no autopay.
- Subscription = ₹100/month → 100 credits. Manual renew. This is the floor on every paid plan, including Plan C.
- Top-up packs = ₹100 / ₹500 / ₹1,000, any time.
- Everything debits the balance automatically. At ₹0 the WhatsApp channel pauses; the store stays live.
- Merchant can top up ₹100 instead of paying ₹350 at once for WhatsApp.

| Action | Credits |
| --- | --- |
| Subscription, monthly | +100 |
| Top-up pack | +100 / +500 / +1,000 |
| Store + Jev + wa.me orders | 0 |
| WhatsApp number (own API) | −350 / month |
| Service message | −0.30 |
| Utility message | −0.30 |
| Marketing message | not allowed |
| Commission, 1% of a TAR order | −1% of value |
| Founder setup | 0 |

Worked month — small shop on WhatsApp, 300 orders × 2 messages:
in 100 sub + 500 top-up = 600 · out 100 base + 350 number + 180 messages = 630.
Tops up ₹500 about every 2 months.

Why it works: ₹350 covers Zernio at ₹96/account (101+ tier) with ₹254 margin. The ₹100 sub covers infra. The ₹100 add-on row above becomes this ₹350 debit; the wallet replaces it.

Rule: credits only pay for what the merchant uses. Unused credits carry forward while the subscription is active.

## Plan C: Commission — later option

- Merchant pays ₹100/month (the wallet subscription) + 1% of order value recorded in TAR.
- Fits: Home business, small shop with few orders.
- Not for: medium shops and chains. Above ₹41,700/month of sales, yearly is cheaper.

| Rate | Monthly sales where commission = ₹417 |
| --- | --- |
| 0.5% | ₹83,400 |
| 1% | ₹41,700 |
| 1.5% | ₹27,800 |

Segments at 1% (assumed, not measured):

| Segment | Orders/mo | Avg order | Commission/mo | Cheaper for merchant |
| --- | --- | --- | --- | --- |
| Home | 90 | ₹300 | ₹270 | Commission |
| Small | 300 | ₹500 | ₹1,500 | Yearly (₹417) |
| Medium | 1,200 | ₹700 | ₹8,400 | Yearly |
| Chain branch | 1,800 | ₹600 | ₹10,800 | Yearly |

Path to ₹50L/month gross commission: ~18,500 home sellers at 1%, or ~12,300 at 1.5%. Small shops mostly stay on yearly.

Rules: the 1% debits the prepaid wallet, never the customer's payment. It works only on orders recorded in TAR. Optional cap: ₹417/month. Messaging and infra costs: see [social.md](social.md).

Decisions before any launch of Plan C: rate (0.5 / 1 / 1.5%), cap, and whether counter sales count.

## Costs

| Paying merchants | Income / mo | Cost / mo | Share |
| --- | --- | --- | --- |
| 0-10 | ₹0-5k | ₹0 | 0% |
| ~50 | ~₹25k | ~₹500 | ~2% |
| ~1,000 | ~₹4.5L | ~₹6k | ~1-2% |
| ~10,000 | ~₹45L | ~₹70k | ~2% |
| ~1,00,000 | ~₹4.5cr | ~₹12L | ~3% |

Infra per merchant = ₹5-12/month (2-6% of what they pay), before messaging.
WhatsApp costs (Zernio tiers, Meta messaging, per-message totals): see [social.md](social.md).

**Rule:** add a paid tier only after paid merchants cover its cost.

## Money flow

- Customer → shop (cash / UPI QR / COD) = never touches us
- Merchant → TAR (Razorpay, INR) = our income
- TAR → foreign services (USD) = only after income covers it

## Milestones

| # | Done when |
| --- | --- |
| M1 | first shop page live with WhatsApp orders |
| M2 | first WhatsApp order captured |
| M3 | first Razorpay payment |
| M4 | 10 paying merchants |
| M5 | Meta verified |
| M6 | official WhatsApp in plan |
| M7 | 100 paying, first field team |
| M8 | ₹50L-1cr monthly income → state #2 |

## Growth

1. Founder sets up store on owner's phone (10 min)
2. Agents (students, homemakers) = 30% of first-year fee, after payment
3. Referral = 1 free month each side
4. Wholesaler → 30-50 retailers (T. Nagar, Koyambedu, Madurai, Coimbatore)
5. TAR badge on every store

Funnel = 30 lakh sellers → 1.5 lakh free → half active → 20-25% paying.

## Risks

| Risk | Plan |
| --- | --- |
| Free forever | sell yearly after orders arrive |
| Meta slow | wa.me now; official API when approved |
| Zernio costly early | cap to income; own API is the exit |
| Autopay distrust | prepaid 1/3/6 months, same rate |
| Rivals copy AI | build agents on core from day one |
| Renewal drop-off | yearly first; orders raise switching cost |

## Merchant research (floors archived from merchants.md)

Tamil Nadu SMB ground truth the product must obey:

- Device: 2–4 GB Android, patchy 4G → assets < 150 KB, offline-tolerant queues.
- Input: Tamil/Tanglish voice-first; Unicode Tamil fonts verified day 0; ≥ 44 pixel tap targets.
- Numbers: code formats ₹ Indian notation (1,25,000) and DD/MM/YYYY — models never format numbers.
- Money: UPI + COD > 95% of orders; COD RTO risk; 20–50% advance tokens for custom orders; evening cash/UPI tally.
- Trust: no jargon ("Add product", never SKU/webhook); every action reversible by 1-tap Undo; margin floor on discounts.
- Channels: WhatsApp-first; buyers call before paying; multi-angle real photos demanded.

Full persona and logistics research: git history (`merchants.md`).

## Sources

- msme.gov.in · statisticstimes.com · businessofapps · TechCrunch · wizmessage
- shopify.com/in/pricing · gofrugal.com
- [social.md](social.md) (WhatsApp, Zernio, Meta)
- merchant research — constraint floors above; full text in git history (merchants.md)
