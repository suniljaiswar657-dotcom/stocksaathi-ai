# StockSaathi AI — Architecture and Phase 1

## Product goal

A simple Hindi-first shop assistant for Indian small businesses. It helps shop owners manage inventory, expiry risk and stock value with a low-friction workflow.

## Current stack

- Next.js App Router 15
- React 19 + TypeScript
- Tailwind CSS
- Lucide icons
- Vercel-compatible frontend

## Phase 1 UI

- Responsive dashboard layout for desktop and mobile.
- Inventory search by product name or category.
- Product create and edit form.
- Quantity, unit, category, purchase price, selling price, low-stock threshold and expiry date.
- Stock increment/decrement controls with a zero-stock guard.
- Batch / lot receiving with per-batch quantity and expiry date.
- Batch-wise expiry overview; product expiry status is derived from active batches.
- Stock movement ledger for opening stock, manual receipts, reductions, quantity adjustments and sale deductions (latest 200 records).
- Sales entry captures product, quantity, per-unit selling price and sale date; successful sales reduce stock using FIFO.
- Natural-language sale requests can specify product, quantity and explicit per-unit price; a review panel previews revenue, product cost and gross profit. Only explicit confirmation creates the sale snapshot, deducts FIFO batches and writes a stock movement; cancellation makes no change.
- Natural-language expense requests accept an explicit amount and description (for example, “Aaj ₹500 bijli bill diya”). A confirmation preview shows date, category and amount; only confirmation saves the expense. Cancellation makes no change.
- Sales history stores up to 1,000 transactions with revenue, cost-of-goods-sold and gross profit snapshots.
- Sales summary reports total revenue, cost of goods sold and gross profit from recorded transactions.
- Expense records store description, locally classified category, amount, expense date and creation timestamp. Categories include utilities, rent, staff, transport, repairs, packaging, marketing, bank charges, supplies, food and refreshments, and other. Expenses can be edited from expense history; description, category, amount and date updates preserve the original record ID and creation timestamp. All dependent gross/net profit and budget analytics recalculate from the updated expense array. Date-filtered expense reports show daily totals and category-wise totals; a client-side CSV export includes individual records, daily subtotals, category subtotals and a grand total, with UTF-8 BOM and CSV escaping for spreadsheet compatibility. Expenses are persisted alongside inventory, sales and suppliers in the existing localStorage record; older records without an expenses array load as an empty expense list.
- A configurable monthly expense budget is persisted in the same localStorage record. The dashboard calculates current-month usage, warns at 80%, flags overspend at 100%, and displays category-wise spending analysis. A zero budget disables budget alerts.
- Net profit = gross product profit − recorded expenses. Date-filtered daily/monthly reports aggregate revenue, product cost, gross profit, expenses and net profit. The Sales & profit view includes a combined Profit & Loss statement with date filters, daily/monthly grouping, five summary totals, per-period rows and a reconciled total row. The P&L can be exported as an Excel-compatible CSV containing individual sale/expense entries, per-period totals and a grand total; a print stylesheet formats the statement for A4 landscape printing or browser Save as PDF. This is an operating estimate, not statutory accounting; unrecorded costs, taxes and fees are excluded. The selected-period reconciliation panel checks duplicate transaction IDs, exact-match duplicate candidates, missing/invalid fields, sales arithmetic, orphan product references and daily/monthly totals against period totals. Issue details can be expanded by category. Exact-match duplicate candidates can be marked as valid repeats or selected for correction; a separate confirmation is required before removal. Removing a confirmed duplicate sale also restores its quantity to the linked product as a new reconciliation batch and writes an IN movement; removing a confirmed duplicate expense updates expense and profit reports. Sales arithmetic can be recalculated from the saved quantity and unit price/cost only after confirmation. Duplicate-ID, incomplete-record, orphan-product and totals-mismatch findings remain manual-review items; no speculative automatic repair is performed. Transactions never entered into the app cannot be identified without an external POS, bank or source ledger. A persistent local reconciliation audit trail records the action, issue category, transaction ID, summary, timestamp and actor label for confirmed duplicate removals, confirmed sales recalculations and decisions to keep matching transactions. The latest 500 events are stored in the existing version-4 browser localStorage object and displayed newest-first in the reconciliation panel. The actor is labelled “Local user (this browser)” because this MVP has no authentication or multi-user identity; it does not establish a real person's identity or provide a tamper-proof server audit log.
- Overview dashboard reads saved sales and provides selectable date-range totals plus daily or monthly revenue / gross-profit breakdowns.
- Supplier directory stores supplier name, optional contact and notes; products can be linked to a preferred supplier.
- Reorder suggestions are calculated locally when available quantity is at or below the product low-stock threshold. Suggested order quantity = configured reorder target − current quantity; estimated purchase cost uses the current product purchase price.
- Calculated stock value, low-stock status and expiry status.
- Rule-based stock suggestions based on the saved inventory.

## Inventory storage boundary

Inventory, movement history, sales, expenses and supplier records are stored in browser `localStorage` under `stocksaathi.inventory.v4`.

- Existing `stocksaathi.inventory.v1`, `v2` and `v3` records are read during migration; old keys are left intact.
- Sales store the product purchase-cost snapshot at the time of sale. Gross profit = (unit selling price − unit cost) × quantity; this is gross product profit before overheads, tax, fees or discounts.
- Stock reductions consume oldest received batches first (FIFO).
- Batch and movement history are local to the same browser profile/device; the movement ledger is capped at 200 entries.

- Data persists across refreshes in the same browser profile.
- Data is not synced between devices or users.
- Clearing browser storage can remove this local inventory.
- This is not a secure multi-user database and must not be treated as a cloud backup.
- Initial sample products are demonstration data. Users can edit them or add their own products.

## Current limitations

- Reports are local to the browser profile and are not consolidated across devices or multiple shop users.
- Expense categories are inferred from descriptions using local keyword rules; classification is a convenience and may need human review. Monthly budget alerts are in-app dashboard warnings, not push notifications.
- Hindi/English text assistant answers from saved inventory, supplier and sales data using local rule-based matching.
- Natural-language stock IN/OUT requests are parsed against exact saved product names and quantities; proposed changes remain pending until the user explicitly confirms. Confirmed changes reuse the stock adjustment and movement ledger logic; cancellation makes no inventory change. Browser Web Speech API provides optional speech input and speech playback where supported; microphone permission is required. No external AI model API is connected.
- Supplier details and reorder planning are local only; no external supplier integration, purchase-order sending, barcode scanning or notifications.
- No authentication or cloud database.
- No product deletion action is provided in this phase.

## Planned modules

1. Dashboard and inventory.
2. Stock movement history and batch-level expiry tracking. (implemented in the current UI)
3. Sales entry and gross profit tracking. (implemented in the current UI)
4. Date-wise daily and monthly sales analytics. (implemented in the current UI)
5. Supplier records and reorder workflow. (implemented in the current UI)
6. Hindi/English voice/text assistant grounded in shop data. (implemented with local rule-based answers and browser speech APIs)
7. Authentication and cloud persistence, only after architecture approval.

## Implementation principles

- Keep this repository independent; do not import assets or code from other projects.
- Keep the README unchanged unless explicitly requested.
- Prefer free/local development and Vercel-compatible hosting.
- Do not introduce paid APIs, database services or external integrations without approved scope.
- Clearly distinguish sample data from real records.
