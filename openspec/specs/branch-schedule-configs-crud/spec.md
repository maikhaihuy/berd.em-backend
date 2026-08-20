# Branch Schedule Configs CRUD Specification

## Purpose

Provide CRUD for `BranchScheduleConfig` (per-branch scheduling rules — custom
availability windows, generation-day settings) as a standalone top-level
resource, consistent with `employee-hourly-rates`, plus a convenience lookup by
`branchId`. This change adds only the CRUD surface; consuming the config in
scheduling logic is a separate, future change.

## Requirements

### Requirement: Branch schedule configs can be created, read, updated, and deleted
The system SHALL provide CRUD endpoints for `BranchScheduleConfig` under `/branch-schedule-configs`, gated by `@RequirePermissions({ action, subject: 'branch-schedule-configs' })`, following the module structure (`module.ts`/`service.ts`/`controller.ts`/`mapper.ts`/`types.ts`/`dto`) used by `employees`.

#### Scenario: Create and fetch a config
- **WHEN** a client with `create` permission submits a `branchId` and scheduling fields (`allowCustomAvailabilityTime`, `availabilityOpenDaysBefore`, `availabilityCloseHoursBefore`, `scheduleGenerationDay`, `note`)
- **THEN** a `BranchScheduleConfig` is created and `GET /branch-schedule-configs/:id` returns it via the module's mapper

#### Scenario: Lookup by branch id
- **WHEN** a client calls `GET /branch-schedule-configs/branch/:branchId`
- **THEN** the config for that branch is returned (or a 404 if the branch has no config yet)

#### Scenario: Unauthorized request is rejected
- **WHEN** a client without the matching `branch-schedule-configs` permission calls any endpoint
- **THEN** the request is rejected per the global `PermissionsGuard` (403)

### Requirement: A branch has at most one schedule config
A `Branch` SHALL have at most one `BranchScheduleConfig` (enforced by the existing `branchId @unique` DB constraint).

#### Scenario: Second create for the same branch is rejected
- **WHEN** a client attempts to create a second `BranchScheduleConfig` for a `branchId` that already has one
- **THEN** the request fails with a 400 Bad Request (via the existing `P2002` → `BadRequestException` handling)

#### Scenario: Application still boots
- **WHEN** the application is started after this change is applied
- **THEN** `pnpm run build` succeeds, `branch-schedule-configs` module is registered in `app.module.ts`, and the Nest application boots without DI errors
