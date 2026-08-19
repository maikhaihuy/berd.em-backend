## Context

`BranchScheduleConfig` is 1:1 with `Branch` (`branchId @unique`) and has no module today. The closest existing precedent for a "conceptually per-parent, but its own top-level resource" entity is `employee-hourly-rates`, which exposes a standalone `/employee-hourly-rates` controller rather than nesting under `/employees/:id/hourly-rates`, plus `attendance-history`'s `GET /attendance-history/assignment/:assignmentId` convenience lookup by parent id.

## Goals / Non-Goals

**Goals:**
- Full CRUD for `BranchScheduleConfig` as a standalone top-level resource, consistent with `employee-hourly-rates`.
- A convenience lookup by `branchId`, consistent with `attendance-history`'s by-parent lookup.
- Enforce the 1:1-with-branch constraint at the DB level (already present via `@unique`) surfaced as a normal `P2002` → 400, no bespoke pre-check.

**Non-Goals:**
- Not folding this into the `branches` module itself — kept as its own module to match the `employee-hourly-rates` precedent and keep `branches` unchanged.
- Not wiring any scheduling logic (availability windows, generation-day) into `master-shift-templates`/`availability` yet — this change only adds the CRUD surface for the config data; consuming it in scheduling logic is a separate, future change.

## Decisions

- **Route shape**: top-level `/branch-schedule-configs` (not nested under `/branches/:id/schedule-config`), matching `employee-hourly-rates`. Alternative considered: nest under `/branches/:branchId/schedule-config` as a true singleton sub-resource — rejected only to stay consistent with the one existing precedent in this codebase rather than introduce a second routing convention; revisit if a reviewer prefers the nested form.
- **Uniqueness**: rely on the existing DB unique constraint (`branchId @unique`) plus the standard `PrismaExceptionFilter` `P2002` handling already documented in `CLAUDE.md` — no service-level "does this branch already have a config" pre-check.

## Risks / Trade-offs

- [Risk] None significant — this is new, isolated, additive functionality with no consumers yet, so there's no regression surface. The only real risk is scope creep into actually wiring the config values into scheduling logic, which is explicitly out of scope here.

## Migration Plan

No schema migration. New module only. Rollback is deleting the module and its permission seed rows; no persisted state to unwind since nothing existed before.

## Open Questions

None currently.
