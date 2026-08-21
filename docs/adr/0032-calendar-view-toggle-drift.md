# ADR-0032: Calendar view toggle — drift resolution

## Status
Accepted (2026-08-21)

## Context
`CONTEXT.md:170` documented a grid↔timeline toggle in the page header that did not exist in the codebase.
Three dormant components (`CalendarMonthGrid`, `CalendarList`, `CalendarWeekView`) lived in
`src/components/calendar/calendar-timeline.tsx` but were never imported by `calendar-view.tsx`.

The drift went unnoticed for multiple commits. The `/impeccable critique` of `/calendar` on
2026-08-21 (snapshot at `.impeccable/critique/2026-08-21T14-37-06Z__app-dashboard-calendar-page-tsx.md`)
caught it.

## Decision
We resolve the drift by aligning documentation to code (NOT by deleting dormant components):

- `CONTEXT.md` now states explicitly that the toggle is NOT implemented and references the dormant
  components by file:line.
- The dormant components stay in `calendar-timeline.tsx` so that future implementation can reuse
  them without re-creating the work.
- The single-lane timeline behavior in `CONTEXT.md:189-196` is unchanged (it is implemented correctly).
- The grid-view overflow contract (`+N` rail, "Expandir todas"/"Colapsar todas") is now scoped to
  `CalendarMonthGrid` only, with a note that the Timeline view (the only rendered view) does not use it.

## Consequences
- Future work to wire up a view switcher has clear documentation of the dormant components.
- A reader of `CONTEXT.md` will not be misled into believing the toggle exists.
- If/when a view toggle is implemented, this ADR can be superseded.

## Related
- Snapshot: `.impeccable/critique/2026-08-21T14-37-06Z__app-dashboard-calendar-page-tsx.md`
- Commits: `112d037`, `0d6c8ba`, `bd8bf32`, `6b396cf` (other calendar fixes in the same critique run)
