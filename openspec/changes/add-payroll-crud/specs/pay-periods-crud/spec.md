## ADDED Requirements

### Requirement: Pay periods can be created, read, updated, and deleted
The system SHALL provide standard CRUD endpoints for `PayPeriod`, gated by `@RequirePermissions({ action, subject: 'pay-periods' })` for `create`/`read`/`update`/`delete`, following the module structure (`module.ts`/`service.ts`/`controller.ts`/`mapper.ts`/`types.ts`/`dto`) used by `employees`.

#### Scenario: Create and fetch a pay period
- **WHEN** a client with `create` permission on `pay-periods` submits a `startDate`/`endDate`
- **THEN** a `PayPeriod` is created with `status: OPEN`, and `GET /pay-periods/:id` returns it via the module's mapper

#### Scenario: Unauthorized request is rejected
- **WHEN** a client without the matching `pay-periods` permission calls any pay-period endpoint
- **THEN** the request is rejected per the global `PermissionsGuard` (403)

### Requirement: Pay period lifecycle transitions are guarded
A `PayPeriod` SHALL move only `OPEN` → `CLOSED` → `FINALIZED`, each via its own dedicated action (`close`, `finalize`) gated by its own permission (`action: 'close'|'finalize', subject: 'pay-periods'`). Calling an action from an invalid current state SHALL fail with a 400.

#### Scenario: Normal lifecycle progression
- **WHEN** a client calls `close` on an `OPEN` pay period, then `finalize` on the now-`CLOSED` pay period
- **THEN** the period's `status` becomes `CLOSED` after the first call and `FINALIZED` after the second

#### Scenario: Invalid transition is rejected
- **WHEN** a client calls `finalize` on a `PayPeriod` still in `OPEN` status, or `close` on one already `FINALIZED`
- **THEN** the request fails with a 400 Bad Request and the period's `status` is unchanged
