# StockSaathi AI — Phase 1 Architecture

## Product goal

A simple, Hindi-first shop assistant for Indian small businesses. The product is intended to help shop owners understand stock, expiry risk, sales and estimated profit without navigating complex business software.

## Phase 1 scope

- Responsive dashboard shell for desktop and mobile.
- Inventory snapshot with client-side search.
- Add-product interaction using local demo state.
- Sample sales and profit overview.
- Sample low-stock and expiry recommendations.
- Hindi-first voice-entry affordance with an explicit preview notice.

## Current implementation

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Lucide icons
- Vercel-compatible project structure

## Architecture boundaries

```
src/
  app/
    layout.tsx       App metadata and root layout
    page.tsx         Dashboard UI and local preview interactions
    globals.css      Global styles and Tailwind layers
```

The current dashboard is frontend-only. Product rows, sales totals, charts and AI suggestions are illustrative demo data. Add-product and search interactions are held in browser memory and are not persisted.

## Planned application modules

1. Dashboard — daily sales, estimated profit and business alerts.
2. Inventory — products, stock movement, categories and suppliers.
3. Expiry monitor — batch-level expiry dates and priority alerts.
4. Sales and profit — revenue, cost price, margin and period reports.
5. Saathi assistant — Hindi voice/text commands and grounded suggestions.
6. Settings — shop profile, units, language and notification preferences.

## Proposed data entities for a later backend phase

- Shop: owner, shop name, preferred language, timezone.
- Product: shop, SKU/barcode, name, category, unit, cost price, selling price.
- StockBatch: product, quantity, received date, expiry date, supplier.
- StockMovement: product, movement type, quantity, timestamp, reference.
- Sale: shop, line items, total, payment method, timestamp.
- Supplier: shop, contact details, notes.

## Implementation principles

- Keep this repository independent; do not import assets or code from other projects.
- Start with free/local development and Vercel-compatible deployment.
- Do not introduce paid APIs, a database, authentication or third-party integrations without an approved scope.
- Keep demo values clearly identified until real shop data is connected.
- Validate calculations and inventory changes before using them for business decisions.

## Next implementation sequence

1. Review and validate the Phase 1 UI.
2. Add real inventory forms and typed domain models.
3. Select and approve persistence/authentication architecture.
4. Implement sales, stock movements and expiry calculations.
5. Add Hindi voice capture and AI assistance after data flows are reliable.
