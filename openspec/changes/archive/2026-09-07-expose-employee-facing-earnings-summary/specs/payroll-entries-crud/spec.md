## ADDED Requirements

### Requirement: Payroll entries carry a discretionary bonus, settable only by Manager/Admin
`PayrollEntry` SHALL have a `bonus` amount (default `0`), separate from the `generate`-computed `totalPay`. The system SHALL provide `PATCH /payroll-entries/:id/bonus` with body `{ bonus: number }`, gated by a new `@RequirePermissions({ action: 'update', subject: 'payroll-entries' })` permission granted only to `Manager` and `Admin` roles (no `$self` condition, and never granted to `Employee`). No other `PayrollEntry` field (`totalPay`, `payPeriodId`, `timeLogId`, etc.) SHALL be hand-editable through this or any other endpoint — they remain `generate`-only.

#### Scenario: Manager sets a bonus on a payroll entry
- **WHEN** a user with `update:payroll-entries` permission calls `PATCH /payroll-entries/:id/bonus` with `{ bonus: 50 }`
- **THEN** the entry's `bonus` field is updated to `50`, `totalPay` and every other field are unchanged, and an audit log row is recorded via `AuditLogsService.record` with the `before`/`after` `bonus` value

#### Scenario: Employee cannot set a bonus
- **WHEN** an Employee (holding only `read:payroll-entries` scoped to `$self`) calls `PATCH /payroll-entries/:id/bonus`
- **THEN** the request is rejected by `PermissionsGuard` (403) before reaching the service

#### Scenario: Bonus endpoint rejects other fields
- **WHEN** a client calls `PATCH /payroll-entries/:id/bonus` with a body containing `totalPay` alongside `bonus`
- **THEN** the global `ValidationPipe` (`forbidNonWhitelisted`) rejects any field other than `bonus`

### Requirement: Bonus is included in read responses and existing entries default to zero
`PayrollEntryResponseDto` and `PayrollEntryMapper.toDto` SHALL include `bonus`. The Prisma migration adding the `bonus` column SHALL default existing rows to `0` with no backfill step required.

#### Scenario: Existing entry has zero bonus after migration
- **WHEN** a `PayrollEntry` created before this change is fetched via `GET /payroll-entries/:id`
- **THEN** its `bonus` field is `0`

#### Scenario: List and get responses surface bonus
- **WHEN** `GET /payroll-entries` or `GET /payroll-entries/:id` returns an entry with a non-zero `bonus`
- **THEN** the response DTO includes that `bonus` value alongside `totalPay`
