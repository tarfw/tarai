# Commerce Kernel — Exact Business State

## Contract

One shared kernel supports retail, restaurant, supermarket, delivery, taxi,
services and future domains. Domain packages add facts and Actions; they do not
fork inventory, orders, payments or accounting.

```text
BUY                                             SELL
supplier -> purchase -> receive -> onhand
                                    |
customer -> order -> reserve -> fulfil -> invoice -> payment -> refund
                                    |
                              balanced postings
```

| Invariant | Rule |
| --- | --- |
| Money | integer minor units plus ISO currency |
| Quantity | integer base units; display conversion belongs to the product unit |
| Price | server resolved from an active price record |
| Stock | `available = onhand - reserved`; it cannot become negative |
| History | orders and invoices snapshot commercial facts |
| Mutation | registered Action + permission + idempotency key + audit event |
| Accounting | each business event writes balanced postings |
| Isolation | every record belongs to one workspace database |

## Records

Commerce uses the shared `records` table. `type` selects the contract; `data`
holds versioned domain fields. No table is created for every business category.

| Type | Core fields | Typical states |
| --- | --- | --- |
| `item` | name, unit, tax, status | active, archived |
| `variant` | item, sku, barcode, attributes | active, archived |
| `price` | variant, amount, currency, channel, starts, ends | active, archived |
| `stock` | variant, location, onhand, reserved | active |
| `purchase` | supplier, lines, currency, totals | draft, ordered, partial, received, cancelled |
| `order` | customer, lines, totals, channel | draft, accepted, fulfilled, cancelled |
| `invoice` | party, order, lines, totals, due | issued, partial, paid, void |
| `payment` | invoice, amount, method, provider, reference | recorded, reversed |
| `refund` | payment, amount, reason, reference | recorded |
| `posting` | account, debit, credit, source | posted |

Long descriptions, specifications, source snapshots, documents and media use
R2. Their record stores the object key, hash, size, media type and version. Stock,
price, quantity, invoice totals and payment state never live only in R2.

## Registered Actions

| Action | Commit |
| --- | --- |
| `catalog.item.save` | create or revise an item |
| `catalog.variant.save` | create or revise a sellable variant |
| `price.set` | add an effective price |
| `stock.adjust` | audited stock correction |
| `purchase.create` | purchase with exact lines |
| `purchase.receive` | atomically receive lines and increase stock |
| `order.create` | snapshot prices and reserve stock |
| `order.fulfill` | consume reserved stock |
| `order.cancel` | release remaining reservation |
| `invoice.issue` | issue receivable from exact order facts |
| `payment.record` | settle all or part of an invoice |
| `refund.record` | refund within the recorded paid balance |

POS Actions reuse the same guarantees for fast counter work. They add cart,
register, receipt and return interactions while preserving exact server pricing,
stock movement and payment references.

## Atomic lifecycle

### Purchase receipt

```text
validate purchase + remaining quantities
  -> update received quantities
  -> increment stock per variant/location
  -> set partial or received
  -> append event
COMMIT
```

Over-receipt rejects the whole transaction.

### Customer order

```text
read active prices + stock
  -> calculate lines/tax/total
  -> reserve every line
  -> create order snapshot
  -> append event
COMMIT
```

Any unavailable line rejects the whole order. Fulfilment moves reserved units
out of onhand. Cancellation releases only the unfulfilled reservation.

### Invoice, payment and refund

```text
invoice.issue   -> receivable debit + revenue/tax credits
payment.record  -> cash/provider debit + receivable credit
refund.record   -> reversal postings bounded by paid/refundable amount
```

Provider and bank references are external evidence, not authority. Adapters
normalize provider payloads, deduplicate references and call the Gateway.

## Business coverage

| Domain | Shared kernel | Domain addition |
| --- | --- | --- |
| Restaurant | variants, stock, order, payment | stations, course timing, table/delivery handoff |
| Supermarket | catalog, barcode, price, POS | scales, batches, expiry and promotions |
| Delivery | order and payment linkage | pickup, route, proof and settlement |
| Taxi | customer, service order, payment | trip, fare meter, route and driver state |
| Sales team | customer, order, invoice | lead, quote, approval and commission |
| Services | item, order, invoice, payment | booking, time, milestone and acceptance |

## Inbox projections

One order can yield different human Actions without copying authority:

| Actor | Projection |
| --- | --- |
| Owner | accept, reject, exception and refund review |
| Kitchen/station | assigned lines and preparation state |
| Courier | reach, collect, deliver and proof |
| Customer | pay, receive and rate |

The parent record remains canonical. Projections expose only fields allowed by
membership, work role and Action policy.

## Sites and artifacts

| Need | Store |
| --- | --- |
| live catalog title, price, availability | Turso records queried by a public binding |
| product image or long description | R2 object referenced by variant/item |
| invoice facts and status | Turso invoice/payment/posting records |
| rendered invoice PDF | immutable R2 artifact plus hash/version in its record |
| compiled public pages | Site release bucket |

Site generation never duplicates inventory as website truth. `site.refresh`
rebuilds catalog bindings from active variants and prices. A public transaction,
when enabled by site policy, must call the same order/payment Actions.

## Recovery and reconciliation

| Failure | Recovery |
| --- | --- |
| client retries | same key + same hash returns the committed result |
| same key, changed input | conflict |
| provider repeats webhook | unique provider/reference and operation key |
| worker stops after commit | event/result is replayed; effect is not repeated |
| partial multi-record write | transaction rolls back |
| balance mismatch | posting validation rejects commit |

Operational reports derive from orders, stock, payments and postings. They are
projections or artifacts, not editable business truth.

## Implemented acceptance

- Catalog, variant, price, stock, purchase, order, invoice, payment and refund
  Actions are registered in `tarharness/src/commerce/`.
- Purchase receiving, order reservation/fulfilment/cancellation and financial
  postings execute atomically.
- Replays and conflicting operation keys are tested.
- POS retains server pricing, returns, register and stock controls.
- Space and Inbox consume commerce records through authorized projections.

See the current [canvas.md](canvas.md) goal.
