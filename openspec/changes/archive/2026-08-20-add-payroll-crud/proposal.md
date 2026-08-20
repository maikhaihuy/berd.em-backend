## Why

`PayPeriod` and `PayrollEntry` exist in `prisma/schema.prisma` and are the terminal step of the pay pipeline (`TimeLog` → `PayrollEntry` → `PayPeriod`, per `openspec/project.md`), but neither has a module — `app.module.ts` still carries `// TODO: Add PayPeriodsModule when created` / `// TODO: Add PayrollEntriesModule when created`. Verified time logs (`TimeLog.status` / `verifiedBy` from `time-tracking`) currently have no way to become payroll output. This change builds both modules so the pay pipeline is actually usable end to end, closing out the two remaining TODOs.

## What Changes

- **New `pay-periods` module** (`PayPeriod`): CRUD (create/read/update/delete) plus lifecycle actions `close` (`OPEN` → `CLOSED`) and `finalize` (`CLOSED` → `FINALIZED`), following the dedicated-action pattern already used for `assignments.check-in/check-out`, `leave-requests.approve/cancel`, `time-tracking.verify`, `master-shifts.generate`, `tasks.complete`.
- **New `payroll-entries` module** (`PayrollEntry`): read/delete, plus a `generate` action that computes `PayrollEntry` rows for a given open `PayPeriod` from verified `TimeLog`s (`status` verified, `verifiedBy` set, no existing `payrollEntry`) not yet paid — computing `totalPay` from `TimeLog.multiplier` and the employee's hourly rate (`EmployeeHourlyRate`, per `openspec/project.md`'s hourly-rate-sync note on `employees`). No generic `create` endpoint — entries are only produced by `generate`, mirroring how `TaskCompletion` is only produced by `tasks.complete`, not a raw `POST`.
- Both modules follow the standard structure: `module.ts`, `service.ts`, `controller.ts`, `mapper.ts`, `types.ts`, `dto/*.dto.ts` (per `employees` reference pattern).
- Register both modules in `app.module.ts`, removing the two TODO comments.
- Add `Permission` seed rows: `create`/`read`/`update`/`delete` + `close`/`finalize` on subject `pay-periods`; `read`/`delete` + `generate` on subject `payroll-entries` (matching the `prisma/seed.ts` convention for dedicated actions).

## Capabilities

### New Capabilities
- `pay-periods-crud`: CRUD + close/finalize lifecycle for `PayPeriod`.
- `payroll-entries-crud`: read/delete + generate-from-verified-time-logs for `PayrollEntry`.

### Modified Capabilities
(none — additive only, no existing endpoint's behavior changes)

## Impact

- Code: new `src/modules/pay-periods/`, new `src/modules/payroll-entries/`, `src/app.module.ts` (register both, drop the 2 TODOs), `prisma/seed.ts` (new permission rows + role grants).
- No schema/migration changes — both Prisma models already exist.
- Depends on `time-tracking`'s `verify` action (already exists) as the input signal for `generate`; depends on `employee-hourly-rates` for pay calculation. Should land after `retrofit-operational-crud-mappers` so `payroll-entries.generate` reads `TimeLog` through the settled `TimeLogMapper`-backed service rather than against code mid-refactor, though it could technically land independently since it queries Prisma directly.
