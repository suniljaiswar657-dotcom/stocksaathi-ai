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
- Sales history stores up to 1,000 transactions with revenue, cost-of-goods-sold and gross profit snapshots.
- Sales summary reports total revenue, cost of goods sold and gross profit from recorded transactions.
- Overview dashboard reads saved sales and provides selectable date-range totals plus daily or monthly revenue / gross-profit breakdowns.
- Supplier directory stores supplier name, optional contact and notes; products can be linked to a preferred supplier.
- Reorder suggestions are calculated locally when available quantity is at or below the product low-stock threshold. Suggested order quantity = configured reorder target − current quantity; estimated purchase cost uses the current product purchase price.
- Calculated stock value, low-stock status and expiry status.
- Rule-based stock suggestions based on the saved inventory.

## Inventory storage boundary

Inventory, movement history, sales and supplier records are stored in browser `localStorage` under `stocksaathi.inventory.v4`.

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
- Hindi speech recognition and AI model calls are not connected.
- Supplier details and reorder planning are local only; no external supplier integration, purchase-order sending, barcode scanning or notifications.
- No authentication or cloud database.
- No product deletion action is provided in this phase.

## Planned modules

1. Dashboard and inventory.
2. Stock movement history and batch-level expiry tracking. (implemented in the current UI)
3. Sales entry and gross profit tracking. (implemented in the current UI)
4. Date-wise daily and monthly sales analytics. (implemented in the current UI)
5. Supplier records and reorder workflow. (implemented in the current UI)
6. Hindi voice/text assistant grounded in shop data.
7. Authentication and cloud persistence, only after architecture approval.

## Implementation principles

- Keep this repository independent; do not import assets or code from other projects.
- Keep the README unchanged unless explicitly requested.
- Prefer free/local development and Vercel-compatible hosting.
- Do not introduce paid APIs, database services or external integrations without approved scope.
- Clearly distinguish sample data from real records.
