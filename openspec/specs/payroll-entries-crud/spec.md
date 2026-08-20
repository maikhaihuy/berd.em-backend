# Payroll Entries CRUD Specification

## Purpose

Provide read/delete for `PayrollEntry` plus a `generate` action that turns
verified, not-yet-paid `TimeLog`s within a pay period's range into computed
`PayrollEntry` rows. Entries are derived data — there is no hand-create endpoint.

## Requirements

### Requirement: Payroll entries can be read and deleted, but not hand-created
The system SHALL provide `read` (list + get-by-id) and `delete` endpoints for `PayrollEntry`, gated by `@RequirePermissions({ action, subject: 'payroll-entries' })`. There SHALL be no generic `create` endpoint — entries are only produced by the `generate` action.

#### Scenario: List and fetch payroll entries
- **WHEN** a client with `read` permission on `payroll-entries` lists entries for a pay period or employee, or fetches one by id
- **THEN** the response is produced by the module's mapper with `totalPay`, `payDate`, `workDate`, `calculatedAt`, `calculatedBy`, and the related `TimeLog`/`Employee`/`PayPeriod` references

#### Scenario: No public create endpoint exists
- **WHEN** a client sends `POST /payroll-entries` with a hand-built body
- **THEN** the route does not exist (404) — entries can only be produced via `POST /pay-periods/:id/payroll-entries/generate` (or equivalent `generate` route)

### Requirement: Payroll entries are generated from verified time logs
`generate(payPeriodId)` SHALL create one `PayrollEntry` per `TimeLog` where `status` is `VERIFIED`, `payrollEntry` is not yet set, and `actualStartTime` falls within `[payPeriod.startDate, payPeriod.endDate]`, computing `totalPay` from the time log's hours, its `multiplier`, and the employee's `EmployeeHourlyRate` effective as of the time log's work date. `generate` is gated by `@RequirePermissions({ action: 'generate', subject: 'payroll-entries' })`.

#### Scenario: Generate creates entries for eligible time logs
- **WHEN** a client calls `generate` on a `PayPeriod` that has 3 `VERIFIED` time logs in range with no existing `PayrollEntry`, and an applicable `EmployeeHourlyRate` for each employee
- **THEN** 3 `PayrollEntry` rows are created, each with `totalPay` computed from hours × rate × multiplier, and each linked 1:1 to its source `TimeLog`

#### Scenario: Generate is idempotent
- **WHEN** `generate` is called twice in a row on the same `PayPeriod` with no new verified time logs in between
- **THEN** the second call creates zero new `PayrollEntry` rows (no duplicates, no error)

#### Scenario: Generate skips time logs with no applicable hourly rate
- **WHEN** an eligible `TimeLog`'s employee has no `EmployeeHourlyRate` row covering the time log's work date
- **THEN** that time log is skipped (no `PayrollEntry` created for it) and reported back to the caller rather than causing the whole `generate` call to fail

#### Scenario: Application still boots
- **WHEN** the application is started after this change is applied
- **THEN** `pnpm run build` succeeds, `pay-periods` and `payroll-entries` modules are registered in `app.module.ts`, and the Nest application boots without DI errors
