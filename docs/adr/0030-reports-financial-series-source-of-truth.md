# ADR-0030: Revenue Series — Cash-Basis Source of Truth

**Status**: Implemented
**Date**: 2026-07-27
**Deciders**: Architect + Implementer

## Context

The `/reports` page had multiple revenue sources with overlapping but inconsistent semantics:

1. `getRevenueReport` — returns `RevenueReport[]` (month, totalRevenue, reservationCount) using cash-basis `paidAt` filter, but `getYearlySummary` used it too
2. `getYearlySummary` — returns `{ year, totalRevenue, totalPayments, byMonth, byMethod }` using cash-basis `paidAt` + 3 parallel DB queries (H4 perf fix)
3. `ReportDecisionSummary.collectedCash` — cash-basis sum from `buildDecisionSummary` pure module
4. `reportDecisionSummary.cash.byMonth` and `cash.annual` — computed inside `buildDecisionSummary` from a flat payment list

The **cash series** (monthly + annual breakdowns by method) was embedded inside `buildDecisionSummary`, but `getYearlySummary` duplicated the annual aggregation with different DB queries. This created two sources of truth for the same cash-basis revenue data.

## Decisions

### 1. `revenue-series.ts` — Single Source of Truth

A new pure domain module `src/lib/reports/revenue-series.ts` exposes:

- `buildMonthlyCollectedCash(payments, rangeStart, rangeEnd, ownerTz, cancelledPaymentIds)` → `MonthlyCollectedCash[]`
- `buildAnnualCollectedCash(payments, year, ownerTz, cancelledPaymentIds)` → `AnnualCollectedCash`

Both functions share the same **cash-basis predicate**:

```
Eligible: status === "COMPLETED"
          paymentType === "RESERVATION"
          deletedAt === null
          paidAt !== null
```

`cancelledCash` is a **subtotal within** `collectedCash` — cancelled reservation payments are INCLUDED in the total, not excluded.

### 2. `buildDecisionSummary` — Uses the Seam

`buildDecisionSummary` in `decision-summary.ts` now calls `buildMonthlyCollectedCash` and `buildAnnualCollectedCash` internally. The `cash` field on `ReportDecisionSummary` is the **canonical monthly + annual revenue series**.

The seam receives:
- `allPayments: CashPaymentInput[]` — flat list of all payments from all reservations in range
- `cancelledPaymentIds: Set<string>` — IDs of payments whose reservation is CANCELLED

### 3. `getYearlySummary` — Rewritten as Adapter Over the Seam

`getYearlySummary(filters?: number | YearlySummaryFilters)` was rewritten to:
- Accept `YearlySummaryFilters { year?, propertyId? }` or legacy positional `year: number`
- Single DB query: `prisma.payment.findMany` with full predicate + reservation join for `userId` + optional `propertyId`
- Build `cancelledPaymentIds` from reservation status
- Call `buildAnnualCollectedCash` and return `AnnualCollectedCash`

Reconciliation: `totalCash === sum(byMonth.collectedCash) === sum(byMethod)`

### 4. `getRevenueReport` — Deprecated Adapter

`getRevenueReport` is deprecated. It remains as an adapter over the seam for backward compatibility. It is **not called from any production UI code** — only from legacy tests.

### 5. Export On-Demand

`getReservationsReportForExport` is no longer called in SSR or on every filter refresh. It is invoked **only** from `handleExcelExport` and `handlePDFExport` with the current effective filters. This eliminates a blocking parallel query from the page's critical path.

### 6. UI Simplification — Removed Redundant Revenue Display

The `/reports` page UI was simplified:
- **Removed**: `last6Months` bar chart (`RevenueBarChart` component deleted)
- **Removed**: duplicate "Ingresos por Mes" card (replaced by `decisionSummary.cash.byMonth` series)
- **Removed**: `revenueData` state, `getRevenueReport` and `getYearlySummary` from SSR and refresh
- **Annual card**: uses `decisionSummary.cash.annual` with `paymentCount`, `totalCash`, `byMethod`, and `byMonth` (as `MonthlyCollectedCash[]`)
- **Single monthly series**: `decisionSummary.cash.byMonth` displayed in the existing bar/list component

### 7. Month Key — `America/Santiago`

`monthKey` in `MonthlyCollectedCash` and `buildMonthlyCollectedCash` uses `getDateKeyInTz(date, BUSINESS_TIME_ZONE).slice(0, 7)` — zero-filled `YYYY-MM` in `America/Santiago` (UTC-3).

## Implementation

### Files Created
- `src/lib/reports/revenue-series.ts` — pure module: predicate, `buildMonthlyCollectedCash`, `buildAnnualCollectedCash`, types
- `src/lib/reports/__tests__/revenue-series.test.ts` — 23 tests (7 predicate, 8 monthly, 8 annual)

### Files Modified
- `src/lib/reports/decision-summary.ts` — added `cash.byMonth` + `cash.annual` via seam calls; `DecisionPaymentInput.method` made optional
- `src/lib/actions/reports.ts` — `getYearlySummary` rewritten; `getRevenueReport` deprecated; `YearlySummaryFilters` interface
- `src/app/(dashboard)/reports/page.tsx` — removed `getRevenueReport`, `getYearlySummary`, `getReservationsReportForExport` from SSR
- `src/app/(dashboard)/reports/_components/reports-client.tsx` — UI simplified; export handlers call `getReservationsReportForExport` on-demand

### Files Deleted
- `src/components/reports/revenue-bar-chart.tsx` — no remaining consumers

## Consequences

### Positive
- Single source of truth for cash-basis revenue series (monthly + annual)
- `buildDecisionSummary` and `getYearlySummary` now produce identical results for the same predicate
- TDD with real predicate tests (not tautologies)
- Export removed from SSR critical path — faster initial page load
- UI reduced complexity: one revenue series source

### Negative
- `getRevenueReport` still exists (deprecated) — adds noise; can be removed once legacy tests are updated
- `getReservationsReportForExport` on-demand: exports run when the user triggers them, with no impact on initial page load. This is the intended behavior, not a limitation.

## References

- ADR-0029: ReportDecisionSummary
- ADR-0020: Business dates timezone
- `src/lib/reports/revenue-series.ts`: Pure domain module
- `src/lib/reports/__tests__/revenue-series.test.ts`: TDD tests
- `src/lib/reports/decision-summary.ts`: Seam integration
- `src/lib/actions/reports.ts`: `getYearlySummary`, `getRevenueReport`
