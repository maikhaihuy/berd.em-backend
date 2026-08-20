## Why

`BranchScheduleConfig` (per-branch scheduling rules: custom availability windows, generation-day settings) exists in `prisma/schema.prisma` but has zero references anywhere in `src/` — no module, no service, nothing reads or writes it. It's the one Prisma model in the domain model diagram (`openspec/project.md`) with no CRUD at all, unrelated to the payroll TODOs already tracked in `app.module.ts`.

## What Changes

- **New `branch-schedule-configs` module** (`BranchScheduleConfig`): standard CRUD (create/read/update/delete), plus a convenience lookup `GET /branch-schedule-configs/branch/:branchId` (matching the existing `attendance-history` convenience-lookup convention, `GET /attendance-history/assignment/:assignmentId`).
- `branchId` is unique on the model (1:1 with `Branch`) — `create` SHALL reject a second config for a branch that already has one (relying on the existing `P2002` → `BadRequestException` Prisma-exception convention, no pre-check needed).
- Standard module structure: `module.ts`/`service.ts`/`controller.ts`/`mapper.ts`/`types.ts`/`dto/*.dto.ts`, following the `employees` reference pattern.
- Register the module in `app.module.ts`.
- Add `create`/`read`/`update`/`delete` `Permission` seed rows for subject `branch-schedule-configs`.

## Capabilities

### New Capabilities
- `branch-schedule-configs-crud`: CRUD for per-branch scheduling configuration.

### Modified Capabilities
(none — purely additive, no existing endpoint changes)

## Impact

- Code: new `src/modules/branch-schedule-configs/`, `src/app.module.ts` (register module), `prisma/seed.ts` (new permission rows).
- No schema/migration changes — the model already exists.
- No dependency on the other 4 changes in this series; can land independently at any point.
