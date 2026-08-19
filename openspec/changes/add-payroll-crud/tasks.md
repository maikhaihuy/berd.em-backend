## 1. pay-periods module

- [ ] 1.1 Create `src/modules/pay-periods/` scaffolding: `pay-period.module.ts`, `pay-period.controller.ts`, `pay-period.service.ts`, `pay-period.mapper.ts`, `pay-period.types.ts`, `dto/create-pay-period.dto.ts`, `dto/update-pay-period.dto.ts`
- [ ] 1.2 Implement CRUD in `PayPeriodService`, mapped through `PayPeriodMapper`
- [ ] 1.3 Implement `close` (`OPEN`→`CLOSED`) and `finalize` (`CLOSED`→`FINALIZED`) with state-guard `BadRequestException`s for invalid transitions
- [ ] 1.4 Add `@RequirePermissions` on every route (`create`/`read`/`update`/`delete`/`close`/`finalize`, subject `pay-periods`)
- [ ] 1.5 Register `PayPeriodsModule` in `src/app.module.ts`, remove the `// TODO: Add PayPeriodsModule when created` comment

## 2. payroll-entries module

- [ ] 2.1 Create `src/modules/payroll-entries/` scaffolding: `payroll-entry.module.ts`, `payroll-entry.controller.ts`, `payroll-entry.service.ts`, `payroll-entry.mapper.ts`, `payroll-entry.types.ts`, `dto/generate-payroll-entries.dto.ts`
- [ ] 2.2 Implement `findAll`/`findOne`/`remove`, mapped through `PayrollEntryMapper` (no generic `create`)
- [ ] 2.3 Implement `generate(payPeriodId)`: query `VERIFIED` `TimeLog`s in the pay period's date range with `payrollEntry` null, resolve each employee's applicable `EmployeeHourlyRate`, compute `totalPay`, create `PayrollEntry` rows inside a `$transaction`
- [ ] 2.4 Handle time logs with no applicable hourly rate: skip + report, don't fail the whole call
- [ ] 2.5 Add `@RequirePermissions` on every route (`read`/`delete`/`generate`, subject `payroll-entries`)
- [ ] 2.6 Register `PayrollEntriesModule` in `src/app.module.ts`, remove the `// TODO: Add PayrollEntriesModule when created` comment

## 3. Permission seeding

- [ ] 3.1 Add `pay-periods` permission rows (`create`/`read`/`update`/`delete`/`close`/`finalize`) to `prisma/seed.ts`
- [ ] 3.2 Add `payroll-entries` permission rows (`read`/`delete`/`generate`) to `prisma/seed.ts`
- [ ] 3.3 Decide and apply role grants (or deliberately leave ungranted pending an explicit admin decision, per the deny-by-default model)
- [ ] 3.4 Run `pnpm db:seed` (or `pnpm db:reset`) locally to confirm the seed applies cleanly

## 4. Tests

- [ ] 4.1 Unit tests for `PayPeriodService` (CRUD + close/finalize valid and invalid transitions)
- [ ] 4.2 Unit tests for `PayrollEntryService.generate` covering: normal generation, idempotency (re-run with no new time logs), missing hourly rate (skip + report), multiplier math
- [ ] 4.3 e2e coverage for the full flow: create pay period → verify time logs (existing `time-tracking` flow) → generate → list payroll entries → close → finalize

## 5. Whole-change verification

- [ ] 5.1 `pnpm run build` succeeds
- [ ] 5.2 `pnpm test` passes (new specs from section 4)
- [ ] 5.3 `pnpm test:e2e` passes
- [ ] 5.4 `pnpm run start:dev` boots without DI/module errors; both modules' routes appear in `/docs`
