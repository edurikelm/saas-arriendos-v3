# ADR-0029: ReportDecisionSummary — nivel 3 Financiero

**Status**: Implemented
**Date**: 2026-07-27
**Deciders**: Architect + Implementer

## Context

The `/reports` page needed a third report tier — the **Decision Summary** — focused on actionable financial and operational data grouped by Billing Type (DAILY/MONTHLY) and Property. It complements the existing executive KPIs (Nivel 1) and collection/occupancy reports (Nivel 2).

## Decisions

### 1. `ReportDecisionSummary` — Scope and Outputs

The report exposes:
- `collectedCash` — sum of COMPLETED RESERVATION payments with `paidAt` in the inclusive business-date range `[rangeStart, rangeEnd]`, **including CANCELLED reservations**. This is the total cash figure.
- `collectedCashFromCancelledReservations` — **subtotal within `collectedCash`** showing how much of that cash came from CANCELLED reservations.
- `outstandingBalance` — `max(totalPrice - ALL completed RESERVATION payments, 0)` for non-CANCELLED reservations intersecting the range. Uses **paid-to-date** (all payments, not limited to range).
- `occupiedNightUnits` / `capacityNightUnits` / `occupancyRate` — date-only inclusive intersection × unitsBooked; CANCELLED excluded.
- `reservationCount` — distinct non-CANCELLED reservation IDs intersecting range.
- `byBillingType` — DAILY and MONTHLY entries with independent metrics.
- `byProperty` — **array** (not Map) for serialization across Server→Client; all properties in scope even zero-value.
- `activity` — NONE / DAILY / MONTHLY / MIXED per property.

### 2. Intersection — Date-Only `clipNightsToRange > 0`

Uses `clipNightsToRange` from `kpis.ts` with **timezone-agnostic epoch-day arithmetic**:
- `startDate` = first night of stay (inclusive)
- `endDate` = last night of stay (inclusive)
- All date comparisons use `Math.floor(date.getTime() / 86_400_000)` — pure day indices

**Result**: Jan 1-31 = 31 days. Feb 1 does NOT intersect Jan 31.

### 3. `paidAt` Filtering — Inclusive Business-Date Range

Cash filtering compares day keys inclusively: `paidDay >= rangeStartDay && paidDay <= rangeEndDay`.

**Rationale**: The filters shown to the Owner are inclusive calendar-date ranges. A payment received on the last visible day—including today in `year_to_date`—must count. Internally this is equivalent to a timestamp interval ending at the start of the following business day.

### 4. CANCELLED Reservations — Cash IS Included in `collectedCash`

`collectedCash` includes ALL COMPLETED RESERVATION payments from both active AND CANCELLED reservations. `collectedCashFromCancelledReservations` is a **subtotal** tracking the cancelled portion.

**Rationale**: Cash that arrived is real revenue, regardless of whether the stay ultimately happened. The separation via the subtotal allows report readers to understand how much cash came from cancelled vs. completed stays.

### 5. `outstandingBalance` — Paid-to-Date, Not Range-Limited

Subtracts **ALL** completed RESERVATION payments for each reservation, regardless of `paidAt`. Not limited to the date range.

**Rationale**: Outstanding balance is a snapshot of the current financial state. A payment made before the range that settles a reservation should reduce the outstanding balance even when viewing a later period.

### 6. Payment `EXTRA` — Never Enters Any Metric

No metric (cash, balance, occupancy) includes `paymentType: EXTRA` payments.

**Rationale**: EXTRA charges (fines, additional services) are independent of the rental's totalPrice.

### 7. `byBillingType` Capacity — Full Portfolio Scope

`capacityNightUnits` for both DAILY and MONTHLY uses the **full capacity of all properties in scope**, not just properties that had reservations of that billing type.

**Rationale**: Shows what percentage of the total available capacity each billing model consumes, enabling comparison of portfolio mix.

### 8. Property Activity — `NONE` for No Active Reservations

Properties with no intersecting active (non-CANCELLED) reservations have `activity: NONE`, not `MIXED`.

**Rationale**: `MIXED` implies both DAILY and MONTHLY activity. Properties with no activity should be `NONE`.

### 9. Date-Only Arithmetic — Timezone-Agnostic

All date computations use `Math.floor(date.getTime() / 86_400_000)` — epoch-day integer division. This ensures dates are treated as calendar day indices, not moments in time.

**Reference**: ADR-0020 (America/Santiago timezone) — the system stores all dates as UTC, but business reports treat them as date-only values.

## Consequences

- `buildDecisionSummary` is a pure domain module — fully unit-testable.
- `getDecisionSummary` server action handles auth, Prisma data loading, and type casting from Prisma enums to domain union types.
- `byProperty` is returned as an **array** for cross-boundary serialization (Server→Client), not a Map.
- `ReportDecisionSummary` interface is fully serializable.

## References

- ADR-0020: Business dates timezone
- ADR-0028: Report KPIs — Semantic Decisions
- `src/lib/reports/decision-summary.ts`: Pure domain module (`buildDecisionSummary`)
- `src/lib/actions/reports.ts`: `getDecisionSummary` server action
- `src/lib/reports/__tests__/decision-summary.test.ts`: domain contract tests
- `src/lib/reports/kpis.ts`: `clipNightsToRange` (date-only, timezone-agnostic)
