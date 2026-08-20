## Context

Pay pipeline per `openspec/project.md`: `TimeLog` (approved worked time, `multiplier` for overtime/holiday) → `PayrollEntry` (1:1 with a `TimeLog`, `totalPay`) → `PayPeriod` (open/closed/finalized window). `TimeLog.status`/`verifiedBy`/`verifiedAt` are already set by `time-tracking`'s `verify` action. `EmployeeHourlyRate` (effective-dated rate rows, `endDate` nullable = current rate) already exists and is synced via `$transaction` from `employees` per `CLAUDE.md`. Neither `PayPeriod` nor `PayrollEntry` has a module — this is genuinely new functionality, not a refactor.

## Goals / Non-Goals

**Goals:**
- `PayPeriod` CRUD + `close`/`finalize` lifecycle actions.
- `PayrollEntry` read/delete + a `generate` action that turns verified, not-yet-paid `TimeLog`s within a pay period's date range into `PayrollEntry` rows.
- Follow the `employees` reference module structure exactly (module/service/controller/mapper/types/dto).

**Non-Goals:**
- No payroll export/reporting endpoints (CSV, bank file, etc.) — out of scope, could be a later change.
- No automatic scheduling of `generate` (e.g. cron) — it's a manually-triggered admin action for this change.
- No changes to `TimeLog`/`time-tracking` or `EmployeeHourlyRate`/`employee-hourly-rates` — `generate` only reads from them.
- No UI/notification concerns.

## Decisions

- **`generate` instead of generic `create` for `PayrollEntry`**: entries are derived data (1:1 with a `TimeLog`, computed `totalPay`), not something a client should hand-author. Matches how `TaskCompletion` is only produced via `tasks.complete`. `generate(payPeriodId)` finds `TimeLog`s with `status: VERIFIED` (the terminal, ready-for-payroll state in `TimeLogStatus`; `PENDING`/`SUBMITTED`/`REJECTED` are excluded), `payrollEntry` null, and `actualStartTime` falling inside `[payPeriod.startDate, payPeriod.endDate]`, then creates one `PayrollEntry` per match inside a `$transaction` (matching the `EmployeeHourlyRate` sync pattern in `employees`).
- **Rate resolution**: for each `TimeLog`, look up the employee's `EmployeeHourlyRate` row where `effectiveDate <= workDate` and (`endDate` is null or `endDate >= workDate`) — the "current rate as of that date" row. `totalPay = hours worked * rate * multiplier`. If no matching rate row exists, that time log is skipped and reported back (not a hard failure of the whole `generate` call) — TBD exact reporting shape at implementation time, but `generate` must not silently drop time logs.
- **Idempotency**: `generate` only touches `TimeLog`s with `payrollEntry` null, so calling it twice on the same `PayPeriod` is safe — already-generated entries aren't recomputed or duplicated (matches `PayrollEntry.timeLogId @unique`).

- **Lifecycle guard**: `close`/`finalize` are only valid from the preceding state (`OPEN`→`CLOSED`→`FINALIZED`); calling `close` on an already-`CLOSED`/`FINALIZED` period, or `finalize` on an `OPEN` one, is a `BadRequestException` — same style as other guarded state transitions in this codebase (e.g. `leave-requests.approve/cancel`).
- **Permission subjects**: `pay-periods` and `payroll-entries` (kebab-case, matching `prisma/seed.ts` convention), with dedicated actions `close`/`finalize`/`generate` alongside standard CRUD verbs.

## Risks / Trade-offs

- [Risk] Pay calculation is the most consequential logic added in this refactor series — a rate-resolution or rounding bug directly produces wrong pay → Mitigation: this change is real new functionality, not a mechanical refactor; write unit tests for `generate`'s rate-resolution and total-pay math with explicit edge cases (no matching rate, overlapping rate rows, `multiplier` != 1) before considering it done.
- [Risk] `generate` racing with a concurrent `time-tracking.verify` call could miss or double-process a `TimeLog` → Mitigation: `$transaction` around the read-then-create per time log, and rely on `PayrollEntry.timeLogId @unique` as a DB-level backstop (a race would surface as a `P2002`, already handled generically per `CLAUDE.md`'s Prisma-exception convention).
- [Risk] `generate`'s date filter (`actualStartTime` inside `[payPeriod.startDate, payPeriod.endDate]`) could miss a time log with a null `actualStartTime` (e.g. one still `VERIFIED` but never clocked, if that combination is possible) → Mitigation: confirm during implementation whether `status: VERIFIED` guarantees `actualStartTime`/`actualEndTime` are set; if not, `generate` must explicitly skip and report null-time entries rather than throwing.

## Migration Plan

No schema migration — both models already exist. New `Permission` seed rows must be added and existing roles granted them (or left ungranted until an admin explicitly assigns them, per the `PermissionsGuard` deny-by-default model — a role with no `pay-periods`/`payroll-entries` grant simply can't hit these routes, which is a safe default for a new payroll surface). Rollback is a plain revert of the new modules + seed rows; no persisted state to unwind since nothing existed before.

## Open Questions

- Whether `generate` should be re-runnable to top up a `PayPeriod` after new time logs are verified post-generation (current design says yes, since it only picks up `TimeLog`s with `payrollEntry` null) — confirm this is the desired behavior, not "generate is one-shot per period."
