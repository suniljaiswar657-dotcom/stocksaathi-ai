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
- Batch / lot receiving captures per-batch quantity, purchase cost per unit and expiry date. Legacy batches without a saved unit cost are migrated using the product's saved purchase price as a one-time fallback; this is an estimate for historical stock, not recovered supplier invoice data.
- Batch-wise expiry overview; product expiry status is derived from active batches.
- Stock movement ledger for opening stock, manual receipts, reductions, quantity adjustments and sale deductions (latest 200 records).
- Sales entry captures product, quantity, per-unit selling price and sale date; successful sales reduce stock using FIFO and calculate cost of goods sold from the actual consumed batches' saved purchase costs. Each sale stores a weighted-average unit cost plus its batch cost layers for audit and reversal.
- Natural-language sale requests can specify product, quantity and explicit per-unit price; a review panel previews revenue, FIFO batch-based product cost and gross profit. Only explicit confirmation creates the sale snapshot with cost layers, deducts FIFO batches and writes a stock movement; cancellation makes no change.
- Natural-language expense requests accept an explicit amount and description (for example, “Aaj ₹500 bijli bill diya”). A confirmation preview shows date, category and amount; only confirmation saves the expense. Cancellation makes no change.
- Sales history stores up to 1,000 transactions with revenue, cost-of-goods-sold and gross profit snapshots.
- Sales summary reports total revenue, cost of goods sold and gross profit from recorded transactions.
- Business calendar dates use the fixed `Asia/Kolkata` time zone: the app derives today and relative dates from India-local calendar parts rather than slicing a UTC ISO timestamp. Sale dates, expense dates, expiry comparisons, current-month budget grouping and daily/monthly report filters therefore use the same `YYYY-MM-DD` India date. Audit timestamps and stock movement timestamps remain ISO UTC instants for reliable ordering, while audit date-range filtering, audit CSV date columns and displayed timestamps convert those instants to India time. Existing saved sale, expense and expiry date strings are preserved; no historical date migration is performed.
- Expense records store description, locally classified category, amount, expense date and creation timestamp. Categories include utilities, rent, staff, transport, repairs, packaging, marketing, bank charges, supplies, food and refreshments, and other. Expenses can be edited from expense history; description, category, amount and date updates preserve the original record ID and creation timestamp. All dependent gross/net profit and budget analytics recalculate from the updated expense array. Date-filtered expense reports show daily totals and category-wise totals; a client-side CSV export includes individual records, daily subtotals, category subtotals and a grand total, with UTF-8 BOM and CSV escaping for spreadsheet compatibility. Expenses are persisted alongside inventory, sales and suppliers in the existing localStorage record; older records without an expenses array load as an empty expense list.
- A configurable monthly expense budget is persisted in the same localStorage record. The dashboard calculates current-month usage, warns at 80%, flags overspend at 100%, and displays category-wise spending analysis. A zero budget disables budget alerts.
- Net profit = gross product profit − recorded expenses. Date-filtered daily/monthly reports aggregate revenue, product cost, gross profit, expenses and net profit. The Sales & profit view includes a combined Profit & Loss statement with date filters, daily/monthly grouping, five summary totals, per-period rows and a reconciled total row. The P&L can be exported as an Excel-compatible CSV containing individual sale/expense entries, per-period totals and a grand total; a print stylesheet formats the statement for A4 landscape printing or browser Save as PDF. This is an operating estimate, not statutory accounting; unrecorded costs, taxes and fees are excluded. The selected-period reconciliation panel checks duplicate transaction IDs, exact-match duplicate candidates, missing/invalid fields, sales arithmetic, orphan product references and daily/monthly totals against period totals. Issue details can be expanded by category. Exact-match duplicate candidates can be marked as valid repeats or selected for correction; a separate confirmation is required before removal. Removing a confirmed duplicate sale also restores its quantity to the linked product as a new reconciliation batch and writes an IN movement; removing a confirmed duplicate expense updates expense and profit reports. Sales arithmetic can be recalculated from the saved quantity and unit price/cost only after confirmation. Duplicate-ID, incomplete-record, orphan-product and totals-mismatch findings remain manual-review items; no speculative automatic repair is performed. Transactions never entered into the app cannot be identified without an external POS, bank or source ledger. A persistent local reconciliation audit trail records the action, issue category, transaction ID, summary, timestamp and actor label for confirmed duplicate removals, confirmed sales recalculations and decisions to keep matching transactions. The latest 500 events are stored in the existing version-4 browser localStorage object and displayed newest-first in the reconciliation panel. The audit panel supports inclusive date-range filtering (default last 30 days), shows the number of matching events, and exports the filtered history as an Excel-compatible CSV with UTF-8 BOM, CRLF line endings, quoted/escaped cells and spreadsheet formula-injection protection. The export includes ISO timestamp, date, actor, action, issue type, record ID, summary and total event count. The actor is labelled “Local user (this browser)” because this MVP has no authentication or multi-user identity; it does not establish a real person's identity or provide a tamper-proof server audit log.
- Overview dashboard reads saved sales and provides selectable date-range totals plus daily or monthly revenue / gross-profit breakdowns.
- Supplier directory stores supplier name, optional contact and notes; products can be linked to a preferred supplier.
- Reorder suggestions are calculated locally when available quantity is at or below the product low-stock threshold. Suggested order quantity = configured reorder target − current quantity; estimated purchase cost uses the current product purchase price.
- Calculated stock value, low-stock status and expiry status.
- Rule-based stock suggestions based on the saved inventory.

## Inventory storage boundary

Inventory, movement history, sales, expenses and supplier records are stored in browser `localStorage` under `stocksaathi.inventory.v4`.

- Existing `stocksaathi.inventory.v1`, `v2` and `v3` records are read during migration; old keys are left intact.
- Each batch stores its own unit purchase cost. FIFO sale COGS is the sum of quantity consumed from each batch × that batch's unit cost. Sales snapshot the weighted-average unit cost, total COGS and consumed cost layers; gross profit = revenue − FIFO COGS. Older sales retain their original saved costs. Legacy stock batches without unit costs are migrated using the product's then-saved purchase price, so historical COGS before this feature cannot be reconstructed from unavailable invoices. This is gross product profit before overheads, tax, fees or discounts.
- Stock reductions consume oldest received batches first (FIFO). Manual stock receipts and quantity increases use the product's current purchase price as the incoming batch cost; explicit batch receiving lets the user enter the actual unit purchase cost and updates the product's current purchase price for subsequent manual receipts. Inventory value is the sum of remaining batch quantities × batch unit costs.
- Batch and movement history are local to the same browser profile/device; the movement ledger is capped at 200 entries.

- Data persists across refreshes in the same browser profile.
- On startup, storage candidates are checked from newest to oldest; malformed or structurally invalid entries are skipped so an older readable inventory can be recovered.
- If the current version is invalid, recovered older data is shown in recovery mode and automatic writes are paused. The damaged current entry is not overwritten; the user can export recovered records and explicitly confirm a validated restore to resume persistence. If no valid saved dataset exists, demo data is not exported as a business backup.
- Data is not synced between devices or users.
- Clearing browser storage can remove this local inventory.
- This is not a secure multi-user database and must not be treated as a cloud backup.
- Initial sample products are demonstration data. Users can edit them or add their own products.

## Local business backup and restore

- A downloadable versioned JSON backup includes products and batch details, stock movements, sales, suppliers, expenses, monthly expense budget and the latest 500 reconciliation audit events.
- Backup export is generated in the browser from the hydrated local state; it does not upload shop data to a server.
- Restore accepts only the StockSaathi backup envelope and validates required collections and record fields before showing a preview.
- Selecting a file does not modify business data. The user must explicitly confirm replacement; cancellation leaves the current data unchanged.
- A confirmed restore writes the complete validated dataset to the existing `stocksaathi.inventory.v4` localStorage key and updates the active UI state.
- Restore replaces data in the current browser profile. It is not a merge, cloud sync, or automatic scheduled backup. Users should download and safely store a backup before restoring another one.
- Backup files contain sensitive shop and financial records; users are responsible for protecting the downloaded file.

## Backup integrity and recovery validation

- New JSON backups carry a SHA-256 digest over the complete version-4 data payload, including batch unit costs and sale cost layers. Restore recalculates the digest before allowing the confirmation preview; checksum mismatch is rejected. Legacy version-4 batch records without unit costs remain valid and are migrated using their product purchase price after checksum/structural validation.
- Earlier version-1 backup envelopes created before checksum support remain restorable after full structural and record validation. Because those legacy files have no digest, the UI labels them clearly as legacy/no-checksum and does not claim cryptographic integrity verification. New exports always include SHA-256.
- The checksum detects accidental corruption or edits but is not a digital signature and does not prove who created the file. Never treat an untrusted backup as authenticated.
- Restore rejects files over 10 MB, malformed JSON, wrong app identity, unsupported backup/schema versions, missing collections, invalid required fields, malformed calendar dates and invalid timestamps, invalid numbers, duplicate IDs within record collections or batch IDs, product/batch quantity mismatches, and inconsistent sales arithmetic. Business dates (sale date, expense date and expiry date) must be real `YYYY-MM-DD` calendar dates; optional expiry dates may be empty. Creation, receipt, audit and export timestamps must be full ISO-style timestamps with an explicit UTC marker or offset. Sale cost layers must contain non-empty batch-number snapshots, positive quantities and non-negative unit costs whose summed quantity and cost reconcile to the sale. A layer is a historical cost snapshot, so its batch number is not required to exist among currently active inventory batches; sold-out/removed stock must not invalidate an otherwise valid historical sale. Cross-record references are also checked before the restore preview: every sale and stock movement must reference a product included in the same backup, and every non-empty product supplier link must reference a supplier in that backup. An absent or empty supplier link remains valid for products without a preferred supplier. A broken reference rejects the backup before any localStorage write; no automatic relinking or record deletion is attempted.
- JSON is parsed as data only; no uploaded content is executed.
- Before writing, restore reads the current localStorage value. After writing, it reads back and compares the exact serialized value. If the write or read-back check fails, it attempts to restore the previous stored value and does not update React state.
- Recovery rollback is best-effort: browser storage quota/security failures can also prevent rollback. Keep an external backup before restoring.
- Validation test matrix: malformed JSON; missing data collection; wrong app identity; wrong backup version; wrong data schema version; duplicate product/sale/expense/audit IDs; duplicate batch IDs; altered payload with stale digest; mismatched product quantity versus batch totals; inconsistent sales revenue/cost/profit; oversized file; localStorage write failure; read-back mismatch. Each invalid backup must be rejected before preview, and storage failures must leave in-memory UI state unchanged.

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


## Backup/restore regression matrix

- Run `npm run test:backup` to execute the Node.js built-in regression suite against the restore validator and restore-handler source contract.
- The matrix covers checksum-free legacy version-4 backups, legacy batches without `unitCost`, stale/corrupt checksums, malformed checksum envelopes, invalid business dates/timestamps, duplicate product/batch IDs, batch-total mismatches, malformed cost layers, inconsistent sale arithmetic, orphan references, oversized files, malformed JSON, preview gating, storage read/write/read-back failures, rollback attempts, and the rule that React state updates only after persistence verification.
- Restore failure handling is best-effort: the suite verifies that rollback is attempted and that the failure branch returns before state setters. Browser quota/security behavior and actual device storage are not simulated by this source-contract suite; a browser integration test remains necessary for full runtime confidence.
- The suite is intentionally non-destructive and does not modify live shop data. It reads the source files and checks the restore flow's implemented safeguards.
