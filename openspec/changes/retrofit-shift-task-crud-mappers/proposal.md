## Why

Six modules in the shift/task domain (`master-shift-templates`, `sub-shift-templates`, `task-templates`, `master-shifts`, `sub-shifts`, `tasks`) return raw Prisma query results straight from service to controller, with ad-hoc `include` objects defined as private fields inside each service. This diverges from the reference pattern established by `employees`/`branches` (a `<name>.mapper.ts` static mapper plus a `<name>.types.ts` file of `satisfies Prisma.XInclude` consts), documented as the required module structure in `CLAUDE.md`. The inconsistency makes response shaping untestable in isolation, duplicates `include` literals across services, and is the largest single cluster of modules missing the pattern.

## What Changes

- Add `<name>.types.ts` to each of the 6 modules: move each service's inline `include`/`select` object into a named const `satisfies Prisma.XInclude`, plus the derived `Prisma.XGetPayload` type.
- Add `<name>.mapper.ts` to each of the 6 modules: a static mapper class (`XMapper.toDto`, matching the `EmployeeMapper` shape) that translates the Prisma payload into the response DTO.
- Update each service method (create/read/update/delete + any custom actions, e.g. `TasksService.complete`) to query using the new types.ts const and return through the mapper instead of the raw Prisma object.
- No new endpoints, no request/response field additions or removals, no permission changes, no schema/migration changes.

## Capabilities

### New Capabilities
- `shift-task-crud-consistency`: documents the mapper/types contract this change establishes for the 6 shift/task modules — response shape is produced by a dedicated mapper, and existing CRUD behavior is preserved.

### Modified Capabilities
(none — no existing capability spec covers these modules yet, and no request/response behavior changes)

## Impact

- Code: `src/modules/master-shift-templates/`, `src/modules/sub-shift-templates/`, `src/modules/task-templates/`, `src/modules/master-shifts/`, `src/modules/sub-shifts/`, `src/modules/tasks/` (service + new mapper.ts/types.ts in each; controllers unchanged unless a return type annotation needs updating).
- No DB/schema changes, no API contract changes, no new dependencies.
- Must keep `pnpm run build` clean and all existing unit/e2e specs for these modules passing (the `tasks` module currently has no `.spec.ts` file — see tasks.md for adding baseline coverage).
