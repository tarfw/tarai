# TAR - Tools, Flows, Cards

> Tools are the tappable surface. Flows compose tool actions. Cards present tools.
> Database, storage and adapters are architecture. Nobody taps a database.

## Layers

| Layer | Holds | Examples |
| :--- | :--- | :--- |
| Architecture | invisible, code-owned | Turso `records`, R2, action registry, event bus, gate, inbox engine, channel and payment adapters |
| Tools | merchant-facing units of work: one tool = a cluster of registered actions + reads | catalog, order, pos |
| Cards and Flows | views on tools: card = saved read + one tap; flow = ordered steps, each step = one tool's action | Products card, Evening Closing flow |

## Decisions

| # | Decision |
| :-: | :--- |
| 1 | DB (Turso) and R2 are architecture, never tools |
| 2 | WhatsApp, Telegram and chat are adapters under one `channel` tool, not three tools |
| 3 | Product, service and commodity are one `catalog` tool. The item record carries `nature: product \| service \| commodity`. Differences live in rules: service skips stock, commodity adds batch and weight units |
| 4 | Stages (Sell, Stock, Money, People, Comms, Manage) are tags over tools in the Business Manager, not tools |
| 5 | Inbox and Flows are surfaces and card shapes, not tools |

## Tool list (14)

| # | Tool | Card | Reach | One tap |
| :-: | :--- | :--- | :--- | :--- |
| 1 | pos | Counter Sales | money | New Sale |
| 2 | order | Orders and Dispatch | customer | Open Queue |
| 3 | invoice | Billing and GST | money | Issue Bill |
| 4 | payment | Payments and UPI | money | Record Receipt |
| 5 | register | Cash Drawer | money | Count Cash |
| 6 | catalog | Products and Prices (product, service, commodity) | data | Add Item |
| 7 | stock | Inventory and Warehouse | data | Adjust Stock |
| 8 | purchase | Supplier POs and GRN | money | New PO |
| 9 | expense | Daily Expenses | money | Log Expense |
| 10 | contact | Customers and Leads | customer | Add Contact |
| 11 | member | Team and Shifts | data | Manage Staff |
| 12 | site | Online Storefront | customer | View Store |
| 13 | task | Manual Tasks | none | Mark Done |
| 14 | channel | Messages (WhatsApp, Telegram via adapters) | customer | Open Chat |

## Planning rules: tools -> flows -> cards

1. Every action belongs to exactly one tool. If an action fits two tools, the split is wrong.
2. Flows only compose existing tool actions. Never invent steps. Max 12 steps. Each step = `crud + action + gate + modifier`.
3. Card = tool x role x usefulness. Jev picks which of the 14 a workspace or member needs; code derives visibility from grants.
4. Three card surfaces, no overlap: tool cards for daily verbs, flow cards for routines, inbox for events.
5. Launch test: if a tool's action does not appear in at least one core flow (sell, buy, close day), defer the tool.
