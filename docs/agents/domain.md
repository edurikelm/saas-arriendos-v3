# Domain docs

**Single-context** layout: one `CONTEXT.md` at the repo root + `docs/adr/` for architectural decisions.

## Consumer rules

- `improve-codebase-architecture`, `diagnose`, `tdd` → read `CONTEXT.md` to learn domain language
- `grill-with-docs` → also reads `docs/adr/` for past decisions
- `CONTEXT.md` uses terms as defined in the domain glossary — do not introduce implementation jargon there

## ADR location

`docs/adr/` at repo root. Each ADR is `000N-short-name.md`.