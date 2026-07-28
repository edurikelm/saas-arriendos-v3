# ADR-0028: Report KPIs — Semantic Decisions

**Status**: Approved (Implemented in Phase 1)
**Date**: 2026-07-27
**Deciders**: Architect + Implementer

## Context

The `/reports` page exposes 4 executive KPIs that needed clarification on:
1. Revenue source (which payments count)
2. Occupancy calculation (clipping, units, external blocks)
3. Collection totals (paginated vs full set)
4. Scope filtering (propertyId, status)

## Decisions

### 1. KPI `Ingresos cobrados` — Payment filters

Payments that count toward "revenue collected" must satisfy:
- `status: COMPLETED`
- `paymentType: RESERVATION` (not EXTRA)
- `deletedAt: null`
- `paidAt` within the requested date range (cash basis, not createdAt)

Source: `sumCompletedPaymentsForOwner` + `getRevenueReport` both enforce these filters.

**Rationale**: EXTRA charges (fines, extra cleaning) are independent charges that don't count toward the rental's totalPrice. Using `paidAt` aligns with cash-basis accounting ("when did money actually arrive?").

### 2. KPI `Ocupación del portafolio` — Clipping + unitsBooked

Formula: `night-units / (days_in_range × units_available)`

Where `night-units` = Σ for each reservation: `clip(reservation_start, reservation_end, range_start, range_end) × unitsBooked`

- Clipping uses **inclusive intersection**: if a reservation spans 15-20 Jan and the requested range is 18-25 Jan, the clipped nights are [18, 19, 20] = 3 nights.
- `unitsBooked` is multiplied because a reservation of 2 units consumes 2× the capacity per night.
- External channel blocks are **excluded** from this KPI for now.
- `CANCELLED` reservations are excluded.

The query uses overlap intersection: `startDate <= rangeEnd AND endDate >= rangeStart`.

**Rationale**: A reservation crossing the boundary of the requested range should only count the nights that actually fall within the range.

### 3. KPIs `Total por cobrar` / `Cobros vencidos` — Full set, not page

These KPIs aggregate over the **complete filtered set**, never over the paginated page slice.

Implementation: `getCollectionReport` returns `{ data, total, page, totalPages, totals }` where `totals` is computed via `sumCollectionTotals(rows)` over the full `rows` array before pagination slicing.

**Rationale**: If an owner has 50 overdue reservations but the page shows 10, the KPI must show the aggregate of all 50, not just the 10 on screen.

### 4. `propertyId` affects all 4 KPIs

When a property is selected in the filter, all 4 KPIs reflect that property's data:
- Revenue: filtered by `reservation.propertyId`
- Occupancy: filtered by `propertyId` in query
- Collection totals: filtered by `propertyId` in `getCollectionReport`

The `status` filter (PENDING/CONFIRMED/COMPLETED/CANCELLED) is **operational** and does not affect financial KPIs. It remains as a filter on the reservations export, separate from the financial metrics.

### 5. Date Range `all` → `Año actual`

The "Todos" quick range previously meant "show all historical data with no date filter." This is ambiguous and was replaced with `year_to_date` — the current calendar year from January 1 to today.

**Rationale**: A dashboard should default to showing the current period, not an unbounded historical record.

### 6. FREE plan — blocks all ranges except `current_month`

Plan FREE users can only view the current month. All other quick ranges (`prev_month`, `last_3`, `last_6`, `year_to_date`, `custom`) are disabled.

The `custom` range is disabled in the DOM (`disabled` attribute) and rejected in the `handleQuickRangeChange` handler.

**Rationale**: Limiting historical data access is a business constraint for the FREE tier.

## Consequences

- All date-range KPIs now require a defined range; no "unbounded" option.
- `getOccupancyReport` now returns `unitsAvailable` per property for correct denominator calculation.
- Collection KPIs now use SSR-computed totals from the full filtered set.

## References

- ADR-0020: Business dates timezone
- CONTEXT.md: Report KPIs section
- `src/lib/reports/kpis.ts`: Pure KPI calculation functions
- `src/lib/actions/reports.ts`: Server actions with KPI logic
