## Context

`src/modules/employees/` and `src/modules/branches/` are the reference implementation for module structure (see `CLAUDE.md`): `<name>.types.ts` holds Prisma `include`/`select` consts (`satisfies Prisma.XInclude`) and derived `Prisma.XGetPayload` types; `<name>.mapper.ts` holds a static class that maps the Prisma payload to a response DTO; the service queries via the types.ts const and returns through the mapper.

The 6 modules in scope currently skip both files. Example (`tasks.service.ts`): a private `include` class field defined inline, and every method (`create`, `findAll`, `findOne`, `update`, `complete`) returns the raw Prisma result (including nested relations) directly to the controller, which Nest then serializes as-is.

This is a mechanical, per-module refactor repeated 6 times — the interesting decisions are about consistency of approach across all 6, not deep architecture.

## Goals / Non-Goals

**Goals:**
- Every one of the 6 modules gets `types.ts` + `mapper.ts` matching the `employees` pattern.
- Response JSON shape is unchanged (or documented if a trivial fix is bundled) so this is a safe, low-risk refactor.
- Each module's full CRUD (plus custom actions: `master-shifts` generation, `tasks.complete`) is verified working end-to-end after the change.

**Non-Goals:**
- No new fields, endpoints, or permission changes.
- No schema/migration changes.
- Not addressing the other 4 change groups (operational entities, access-control cleanup, payroll, branch-schedule-config) — those are separate OpenSpec changes.

## Decisions

- **Mapper granularity**: one mapper class per module (not per include-variant), with `toDto` accepting the full-include payload type — matching `EmployeeMapper`, which composes partial includes by having the caller pass whichever payload shape it has. Alternative considered: a single shared generic mapper utility — rejected because the reference pattern (and `CLAUDE.md`) is explicitly per-module static mapper classes, and the entities have distinct DTO shapes.
- **types.ts content**: the include const moves from a private service field to an exported const in `types.ts`, named `<entity>Include` (e.g. `taskInclude`), `satisfies Prisma.TaskInclude`. The derived payload type is `<Entity>WithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>`.
- **Order of modules**: `task-templates` → `master-shift-templates` → `sub-shift-templates` → `master-shifts` → `sub-shifts` → `tasks`, i.e. templates before instances, since instance modules (`master-shifts`/`sub-shifts`/`tasks`) reference template relations in their includes and it's easier to verify each layer once its dependency's shape is settled. This is an ordering preference, not a hard dependency — each module's mapper/types are self-contained files.
- **No DTO field changes**: where the raw Prisma output already matches what the DTO/Swagger annotations imply, the mapper is a straight pass-through (`return { ...payload }` shaped to the DTO) rather than an opportunity to redesign the response. Any shape fix found along the way must be called out explicitly in the task and kept minimal.

## Risks / Trade-offs

- [Risk] A mapper introduced for a module silently drops or renames a field the frontend depends on (no consumer contract test exists) → Mitigation: diff the mapper's output DTO fields against the current raw Prisma `include` shape field-by-field before wiring it in; keep field names identical unless a rename is explicitly listed as a task.
- [Risk] `tasks` module has no existing `.spec.ts` — regressions during refactor wouldn't be caught by `pnpm test` → Mitigation: task list includes adding a baseline unit spec for `TasksService` before/alongside the refactor.
- [Risk] Six modules touched in one change increases review surface → Mitigation: tasks.md sequences them as independent, individually-verifiable units; the change can be applied incrementally module-by-module even though it's tracked as one OpenSpec change.

## Migration Plan

No data migration. Deploy as a normal code change: land the refactor, run `pnpm run build` + `pnpm test` + `pnpm test:e2e` (which exercise these routes), and manually smoke-test each module's CRUD via `/docs` (Swagger) or a REST client before merging. Rollback is a plain revert — no schema or persisted-state changes to unwind.

## Open Questions

- None currently — flag here if a module's current raw response turns out to already diverge from its DTO/Swagger annotation in a way that needs a product decision (fix silently vs. treat as a breaking change).
