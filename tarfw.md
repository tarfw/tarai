# TAR - Tools, Flows, Cards

## Concept

```
TAR         = Architecture + Tools + Cards

Architecture = Turso (records) + R2 (files) + Action Registry
             + Events + Gates + Inbox engine + Adapters
             invisible. nobody taps a database.

User         = a member of a workspace. the app is members only.
Workspace    = owner + admin + cashier + ...   -> one business boundary
Merchant     = the owner. the first member.
Customer     = storefront only. never a member.

Tool         = one merchant verb = a cluster of registered actions + reads
Card         = Tool x Role x Usefulness        -> what a member sees and taps
Flow         = Step + Step + ...               -> max 12
Step         = CRUD + Action + Gate + Modifier
Action       = the only thing that writes. belongs to exactly one tool.

Catalog      = Product + Service + Commodity   -> one tool, a `nature` field.
                                               rules differ, the tool does not.
Channel      = WhatsApp + Telegram + ...       -> one tool, adapters inside.
Stage        = a tag over tools (Business Manager). never a tool.
Inbox, Flow  = surfaces and card shapes. never tools.

Integration  = adapter -> registered action -> one of the 14 tools
               built and reviewed at build time, never found at runtime.
               no model on run.

Site         = one tool, two modes, one door.

               Mode 1  CURATED   describe once -> Jev picks design + recipes.
               Mode 2  SANDBOX   member prompts -> LLM writes Astro code.
                                 built in an isolated box.          (later)

                    |                        |
                    +----> release in R2 <---+
                               |
               ONE sites worker serves *.tar.site
               subdomain -> workspace -> release
                               |
               gate -> publish tap -> rollback tap
               publish writes an immutable release. rollback repoints.

               the LLM writes looks. never checkout, payment, tax, price, stock.
               the workspace owns the URL. the mode can change, the URL does not.
               sandbox, builder, releases = architecture. the tool stays one.
```

Rules that follow:

- A flow composes existing actions only. It never invents a step.
- Every write = one registered action + gate + idempotency. No other path.
- A tool with no core flow (sell, buy, close day) is deferred, not built.

## Tool list (14)

| # | Tool | Card | Reach | One tap |
| :-: | :--- | :--- | :--- | :--- |
| 1 | pos | Counter Sales | money | New Sale |
| 2 | order | Orders and Dispatch | customer | Open Queue |
| 3 | invoice | Billing and GST | money | Issue Bill |
| 4 | payment | Payments and UPI | money | Record Receipt |
| 5 | register | Cash Drawer | money | Count Cash |
| 6 | catalog | Products and Prices | data | Add Item |
| 7 | stock | Inventory and Warehouse | data | Adjust Stock |
| 8 | purchase | Supplier POs and GRN | money | New PO |
| 9 | expense | Daily Expenses | money | Log Expense |
| 10 | contact | Customers and Leads | customer | Add Contact |
| 11 | member | Team and Shifts | data | Manage Members |
| 12 | site | Online Storefront | customer | View Store |
| 13 | task | Manual Tasks | none | Mark Done |
| 14 | channel | Messages | customer | Open Chat |
