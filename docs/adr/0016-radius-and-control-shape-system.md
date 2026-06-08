# ADR-0016: Radius and Control Shape System

## Status

Accepted

## Context

RentalPro has a dark, dense SaaS interface with tables, dashboards, calendar grids, and form-heavy flows. Several areas currently mix strongly rounded pill shapes with softer rectangular surfaces:

- Calendar reservation bars use `rounded-full` inside a rectangular grid.
- Calendar and navbar controls mix pill wrappers with rectangular buttons and selects.
- Status badges and plan chips often use pill radii while surrounding cards, tables, and filters use smaller rectangular radii.
- Large surfaces and UI primitives already use a shadcn/Tailwind v4 token scale, but feature code sometimes overrides that scale directly.

This creates visual noise because the interface alternates between two shape languages: soft rectangular SaaS controls and capsule/pill controls. The desired direction is **rectangular with soft corners**, not fully rounded pills.

Tailwind v4 maps radius tokens in `src/app/globals.css`:

```css
:root {
  --radius: 0.375rem;
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

In this project, the 6px base radius is `--radius`, exposed as `rounded-lg`. `rounded-md` is smaller, approximately 4px.

## Decision

Use a **soft rectangular radius system** across RentalPro. Decorative pill shapes should be removed from rectangular controls, chips, and calendar reservation bars.

Use `rounded-full` only when the element is geometrically or semantically circular.

### Radius Rules

| Element type | Preferred radius | Notes |
|---|---|---|
| Primary controls: buttons, inputs, selects | `rounded-lg` | Current 6px base radius in this project. |
| Compact chips, badges, status labels | `rounded-md` | Smaller radius keeps tags compact and rectangular. |
| Cards, dialogs, popovers, dropdown panels | `rounded-lg` or `rounded-xl` | Larger surfaces may use one step above controls. Do not reduce globally without visual review. |
| Calendar reservation bars | `rounded-md` or `rounded-lg` | Never `rounded-full`; bars should integrate with the calendar grid. |
| Calendar continuation edges | `rounded-sm`, `rounded-l-*`, `rounded-r-*` | Preserve continuation semantics without pill ends. |
| Avatars and initials | `rounded-full` | Circular by meaning. |
| Status dots, color swatches, loading spinners | `rounded-full` | Circular by geometry. |
| Progress bars | `rounded-full` | Standard pill track/fill pattern; not a conflicting control shape. |

### Height Rules

Do not normalize heights globally as part of this work.

The current SaaS control density scale is appropriate:

| Height | Use |
|---|---|
| `h-6` | Extra compact chips or icon controls. |
| `h-7` | Dense controls, mobile controls, table-adjacent controls. |
| `h-8` | Default application controls. |
| `h-9` | Higher-emphasis controls such as account menus or larger actions. |

The inconsistency being addressed is shape language, not vertical rhythm. Height changes should happen only when a specific screen has a separate spacing or density problem.

## Implementation

Implementation is split into independently grabbable issues:

- [#147: Document radius and control-shape system](https://github.com/edurikelm/saas-arriendos-v3/issues/147)
- [#148: Align shared UI primitives with radius system](https://github.com/edurikelm/saas-arriendos-v3/issues/148)
- [#149: Normalize calendar controls and reservation bar radii](https://github.com/edurikelm/saas-arriendos-v3/issues/149)
- [#150: Normalize dashboard layout control radii](https://github.com/edurikelm/saas-arriendos-v3/issues/150)
- [#151: Apply radius system across domain screens](https://github.com/edurikelm/saas-arriendos-v3/issues/151)

Implementation guidance:

1. Start with documentation and shared primitives.
2. Prioritize the calendar next, because it has the most visible shape mismatch.
3. Normalize dashboard layout controls after the calendar.
4. Sweep domain screens last to avoid broad cosmetic churn before the core system is stable.
5. Preserve `rounded-full` for semantic circles: avatars, dots, spinners, color swatches, and progress indicators.

## Consequences

### Positive

- The UI uses one coherent SaaS shape language.
- Calendar reservations look integrated with the grid rather than floating as capsules.
- Badges and controls become easier to scan because their shape no longer competes with avatars and status dots.
- Future contributors have explicit rules for when `rounded-full` is acceptable.
- The change can be delivered incrementally by area without requiring a full visual rewrite.

### Negative

- Some existing screens may feel slightly less playful after pill shapes are removed.
- Calendar reservation bars may require visual tuning after the first pass, especially for multi-week continuation edges.
- A partial rollout can temporarily leave a mix of old and new radii until all implementation issues are complete.

## References

- `src/app/globals.css` radius tokens
- ADR-0014: `docs/adr/0014-theme-architecture.md`
- ADR-0015: `docs/adr/0015-responsive-design-strategy.md`
