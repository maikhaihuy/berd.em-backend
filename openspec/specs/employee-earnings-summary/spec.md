# Employee Earnings Summary Specification

## Purpose

TBD

## Requirements

### Requirement: Employee can fetch their own month-to-date earnings summary
The system SHALL provide `GET /payroll-entries/summary?employeeId=&from=&to=`, gated by `@RequirePermissions({ action: 'read', subject: 'payroll-entries' })` and scoped by the caller's ability the same way `GET /payroll-entries` is (an Employee's `$self` condition restricts `employeeId` to their own). `from`/`to` bound `PayrollEntry.workDate` and default to the current calendar month when omitted. The response SHALL total `shiftPay`, `approvedOt`, and `bonus` across matching `PayrollEntry` rows plus their `total`.

#### Scenario: Employee fetches their own current-month summary
- **WHEN** an Employee with a `read:payroll-entries` grant scoped to `{ employeeId: '$self' }` calls `GET /payroll-entries/summary` with no `employeeId`, `from`, or `to`
- **THEN** the response covers only that employee's `PayrollEntry` rows with `workDate` in the current calendar month, and `employeeId` in the response matches the caller

#### Scenario: Employee cannot summarize another employee
- **WHEN** an Employee calls `GET /payroll-entries/summary?employeeId=<someone else's id>`
- **THEN** the response is scoped by `accessibleWhere(ability, 'read', 'payroll-entries')` the same as `findAll`, so no rows belonging to the other employee are included (empty or self-only result, never a 403 that reveals the other employee's data shape)

#### Scenario: Regular pay and approved overtime are split from a single totalPay
- **WHEN** a `PayrollEntry` in range has a `timeLog` with `overtimeMinutes: 60` out of a 480-minute (8 hour) shift, and `totalPay: 100`
- **THEN** the summary attributes `100 * (60/480) = 12.5` to `approvedOt` and the remaining `87.5` to `shiftPay` for that entry, using `TimeLog.overtimeMinutes` as the overtime signal rather than `TimeLog.multiplier`

#### Scenario: Entry with zero-duration time log does not divide by zero
- **WHEN** a `PayrollEntry`'s `timeLog` has `actualStartTime` equal to `actualEndTime`
- **THEN** that entry contributes its full `totalPay` to `shiftPay` and `0` to `approvedOt`, without error

### Requirement: Summary includes the most recently finalized pay period's paid total
The response SHALL include a `previousPeriod` field: the most recent `PayPeriod` with `status: FINALIZED` (ordered by `endDate` descending) that has at least one `PayrollEntry` for the summarized employee, with `payPeriodId`, `startDate`, `endDate`, `status`, and `totalPaid` (sum of `totalPay + bonus` across that employee's entries in that period). `previousPeriod` SHALL be `null` when the employee has no `FINALIZED` period with entries.

#### Scenario: Previous finalized period is reported
- **WHEN** an employee has entries in two `FINALIZED` pay periods, one `CLOSED` period, and the current `OPEN` period
- **THEN** `previousPeriod` reflects the `FINALIZED` period with the latest `endDate`, not the `CLOSED` or `OPEN` one

#### Scenario: No finalized period yet
- **WHEN** an employee has entries only in `OPEN` or `CLOSED` pay periods
- **THEN** `previousPeriod` is `null`
