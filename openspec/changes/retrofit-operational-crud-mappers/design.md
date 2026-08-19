## Context

Same reference pattern and motivation as `retrofit-shift-task-crud-mappers`: `employees`/`branches` establish `<name>.types.ts` (Prisma `include`/`select` consts) + `<name>.mapper.ts` (static `toDto`); these 3 modules skip both.

Notable per-module specifics:
- `assignments`: has `check-in`/`check-out` custom actions (`@RequirePermissions({ action: 'check-in'|'check-out', subject: 'assignments' })`) beyond plain CRUD.
- `attendance-history`: read-heavy audit log (create + list-by-assignment + get-by-id + list); no update/delete endpoints exist today — that's intentional (append-only history) and out of scope to change.
- `time-tracking` (`TimeLogService`/`TimeLogMapper`, controller route prefix differs from folder name): has `verify` custom action, and its permission `subject` is `time-logs`, not `time-tracking` — the mapper/types file naming should follow the module folder (`time-tracking.mapper.ts`) while the DTO/class naming can follow the entity (`TimeLog`), matching what's already in `time-tracking.controller.ts`.

## Goals / Non-Goals

**Goals:**
- All 3 modules get `types.ts` + `mapper.ts`, response shape unchanged.
- Custom actions (check-in/check-out, verify) keep working through the mapper.

**Non-Goals:**
- Not adding update/delete to `attendance-history` (append-only log is intentional).
- Not touching `assignments`'/`time-tracking`'s permission subject naming (`time-logs` vs. folder name `time-tracking`) — that's a pre-existing, working convention, not part of this refactor.

## Decisions

- Same `<entity>Include` / `<Entity>WithRelations` naming convention as `retrofit-shift-task-crud-mappers`, for consistency across both changes.
- `time-tracking` module's mapper class is named `TimeLogMapper` (matching the underlying Prisma model `TimeLog`), file named `time-tracking.mapper.ts` (matching the module folder) — mirrors the existing `employee-hourly-rates` module where file/folder naming and entity naming already diverge safely.
- Order within this change: `attendance-history` first (simplest, read-mostly, lowest risk), then `assignments` (check-in/out), then `time-tracking` (verify, feeds payroll — highest downstream impact, done last with most care).

## Risks / Trade-offs

- [Risk] `time-tracking`'s `verify` action feeds payroll entries downstream (per `openspec/project.md`: `TimeLog` → `PayrollEntry`) — a mapper bug here has payroll blast radius → Mitigation: do this module last, add/extend unit spec coverage for `verify` before merging, manually verify a full verify→payroll-ready flow via `/docs`.
- [Risk] `assignments` check-in/check-out also writes `AttendanceHistory` rows as a side effect — a shape change in one module's mapper could mask a regression the other module's tests would have caught → Mitigation: keep this change's `attendance-history` scenario coverage (below) exercising the check-in/out-triggered log entries, not just standalone `attendance-history` creation.

## Migration Plan

No data migration. Land after `retrofit-shift-task-crud-mappers`. Verify via `pnpm run build`, `pnpm test`, `pnpm test:e2e`, and manual smoke test of check-in → check-out → time-log verify chain via `/docs`. Rollback is a plain revert.

## Open Questions

None currently.
