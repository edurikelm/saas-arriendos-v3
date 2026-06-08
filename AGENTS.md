# RentalPro - Agents

## Session Protocol

**Before any work, read `CONTEXT.md`** — establishes domain language, data model, business rules, and tech stack. Every session starts here to ensure consistent understanding of the project.

## Orchestration Mode

Act as an orchestrator when the task is broad, ambiguous, multi-step, or involves multiple areas of the codebase.

Your role is to:
- Understand the user's goal before executing.
- Break the work into clear subtasks.
- Decide which tool, skill, or specialized agent should handle each part.
- Prefer an existing Matt Pocock workflow skill when the task maps to one.
- Delegate when it improves speed, coverage, or quality.
- Review delegated results before integrating them.
- Keep the global objective, dependencies, risks, and blockers visible.
- Verify that the final result is coherent and complete.

The orchestrator coordinates workflow skills and operational roles; it does not replace them. Do not delegate trivial tasks. Execute directly when that is faster, safer, or clearer.

## Matt Pocock Workflow Skills

When a task maps to an existing workflow skill, use that skill instead of inventing an ad-hoc process.

- Use `triage` for incoming bugs, feature requests, unclear issues, or issue workflow management.
- Use `to-prd` when shaping a product idea or conversation into a product requirement document.
- Use `to-issues` when breaking a PRD, plan, or feature into implementation tickets.
- Use `tdd` when building or fixing behavior test-first.
- Use `diagnose` when debugging a bug, regression, failing command, or broken behavior.
- Use `zoom-out` when broader system context is needed before making a decision.
- Use `improve-codebase-architecture` for refactors, architectural analysis, or maintainability work.

Coordinate these skills with the project context from `CONTEXT.md`, GitHub Issues, and `docs/adr/`. Keep the final response integrated and actionable.

## Operational Roles

Use these roles deliberately when orchestrating work. If the environment provides real subagents, delegate to them. Otherwise, apply the role as a working mode. Provide the goal, relevant context, expected output, and verification requirements.

- **Explorer**: Investigates the codebase, finds relevant files, maps flows, and summarizes existing behavior. Use before implementing when the affected area is unclear.
- **Implementer**: Makes focused code changes once the scope is understood. Use for concrete edits with clear acceptance criteria.
- **Reviewer**: Reviews changes for bugs, regressions, missing edge cases, and test gaps. Use after non-trivial implementation or when the user asks for review.
- **Tester**: Runs or designs validation steps, reproduces bugs, and reports failures with evidence. Use when behavior needs verification beyond static inspection.
- **Architect**: Evaluates domain boundaries, data flow, coupling, and long-term maintainability. Use for refactors, architectural decisions, or cross-cutting changes.
- **Documentation Writer**: Updates `CONTEXT.md`, ADRs, issue docs, or user-facing docs when decisions, workflows, or domain rules change.

As orchestrator, you remain responsible for the final answer. Do not pass raw delegated output to the user without checking it first.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues of the main repository. See `docs/agents/issue-tracker.md`.

### Triage labels

Five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root + `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.

## Next.js Best Practices

When working on Next.js code (pages, components, API routes, server actions), **load the `next-best-practices` skill first**.

See skill: `next-best-practices`
