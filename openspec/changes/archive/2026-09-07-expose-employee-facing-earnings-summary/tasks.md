## 1. Schema & migration

- [x] 1.1 Add `bonus Decimal @db.Decimal(12, 2) @default(0)` to `PayrollEntry` in `prisma/schema.prisma`
- [x] 1.2 Run `pnpm db:dev --name "add-payroll-entry-bonus"` to generate and apply the migration
- [x] 1.3 Verify existing rows default to `bonus = 0` with no manual backfill needed

## 2. Permissions & seed

- [x] 2.1 Add `{ action: 'update', subject: 'payroll-entries', description: 'Update a payroll entry\'s bonus' }` to the permission catalog in `prisma/seed.ts`
- [x] 2.2 Grant `update:payroll-entries` to `Manager` and `Admin` role grants (no condition) — do NOT grant it to `Employee`
- [x] 2.3 Run `pnpm db:seed` and confirm the new permission/grants apply idempotently on re-seed

## 3. Bonus field & update endpoint

- [x] 3.1 Add `bonus` to `PayrollEntryResponseDto` and to `PayrollEntryMapper.toDto`
- [x] 3.2 Create `dto/update-payroll-entry-bonus.dto.ts` with a single required `bonus: number` field (validated, whitelisted)
- [x] 3.3 Add `PayrollEntryService.updateBonus(id, bonus, currentUserId)`: update the row, call `AuditLogsService.record` with `before`/`after` bonus values, throw `NotFoundException` on `P2025`
- [x] 3.4 Add `PATCH /payroll-entries/:id/bonus` to `PayrollEntriesController`, gated by `@RequirePermissions({ action: 'update', subject: 'payroll-entries' })`
- [x] 3.5 Add Swagger `@ApiOperation`/`@ApiResponse`/`@ApiBody` for the new endpoint

## 4. Earnings summary endpoint

- [x] 4.1 Add `dto/payroll-entry-summary-response.dto.ts` (`employeeId`, `from`, `to`, `shiftPay`, `approvedOt`, `bonus`, `total`, `previousPeriod`)
- [x] 4.2 Add `dto/payroll-entry-summary-query.dto.ts` for `employeeId?`, `from?`, `to?` query params, defaulting `from`/`to` to the current calendar month when omitted
- [x] 4.3 Add `PayrollEntryService.summary(query, ability)`: fetch entries via `accessibleWhere(ability, 'read', SUBJECT)` filtered by `workDate` range and optional `employeeId`, with `timeLog` included
- [x] 4.4 Implement the per-entry regular/OT split using `timeLog.overtimeMinutes` and `timeLog.actualStartTime`/`actualEndTime` per design.md Decision 2, guarding against zero-duration entries
- [x] 4.5 Implement the `previousPeriod` lookup: most recent `FINALIZED` `PayPeriod` (by `endDate` desc) with at least one entry for the employee, summing `totalPay + bonus`; `null` when none exists
- [x] 4.6 Add `GET /payroll-entries/summary` to `PayrollEntriesController`, gated by `@RequirePermissions({ action: 'read', subject: 'payroll-entries' })` — register this route before `GET /payroll-entries/:id` so `summary` isn't swallowed by the `:id` param route
- [x] 4.7 Add Swagger docs for the summary endpoint

## 5. Tests

- [x] 5.1 Unit test: `updateBonus` updates the field, leaves other fields untouched, and records an audit log entry
- [x] 5.2 Unit test: `summary` splits `shiftPay`/`approvedOt` correctly for an entry with `overtimeMinutes` set
- [x] 5.3 Unit test: `summary` handles a zero-duration `timeLog` without dividing by zero
- [x] 5.4 Unit test: `summary` returns `previousPeriod: null` when no `FINALIZED` period has entries, and the correct one when multiple periods exist
- [x] 5.5 E2e test: Employee can `GET /payroll-entries/summary` for themselves (no `employeeId` param) and gets only their own data
- [x] 5.6 E2e test: Employee gets 403 on `PATCH /payroll-entries/:id/bonus`
- [x] 5.7 E2e test: Manager/Admin can set a bonus via `PATCH /payroll-entries/:id/bonus` and it's reflected in a subsequent `summary` call

## 6. Verification

- [x] 6.1 `pnpm lint` and `pnpm run build` pass (build clean; lint has 13 pre-existing errors on `develop` unrelated to this change, verified via `git stash` — this change adds none)
- [x] 6.2 `pnpm test` and `pnpm test:e2e` pass (366 unit tests: 365 pass, 1 pre-existing flaky timeout in `password.service.spec.ts` unrelated to this change, passes in isolation; `payroll-crud.e2e-spec.ts` — the suite covering this change — passes 10/10 via `pnpm test:e2e`)
- [x] 6.3 Manually verify both new endpoints in `/docs` (Swagger) with an Employee and a Manager/Admin token (confirmed via live `/docs-json` route listing + real login tokens against the running dev server)
