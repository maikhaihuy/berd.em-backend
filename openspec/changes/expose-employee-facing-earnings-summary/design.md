## Context

The staffhub-frontend `build-income-overview-and-shift-earnings-tabs` proposal needs an
Employee to see, without Admin/Manager help:
- Their month-to-date earnings broken down by category: shift pay, approved OT, bonus
  (delivery income is out of scope, blocked on `add-delivery-receipt-ocr-approval`).
- The paid total from their most recently finalized pay period.

Current state, confirmed by reading the code (not just the schema):
- `PayrollEntry` (`prisma/schema.prisma:660-681`) already carries `payPeriod` nested in
  every response via `payrollEntryInclude` (`payroll-entry.types.ts`) — `id`, `status`,
  `startDate`, `endDate`. **No new `pay-periods` grant is needed**; the earlier proposal's
  Gap 1 is resolved by what already exists.
- `PayrollEntry.totalPay` is a single combined figure: `hours × rate × timeLog.multiplier`
  (`payroll-entry.service.ts:139-147`). There is no stored split between regular and
  overtime pay.
- `TimeLog.overtimeMinutes` (nullable `Int`) already records how much of a verified time
  log's duration was overtime — set at time-log creation/verification, independent of
  `multiplier` (which is a generic "pay multiplier", not OT-specific per its own Swagger
  description: "Pay multiplier (e.g., 1.5 for overtime)"). Only `VERIFIED` time logs ever
  become `PayrollEntry` rows (`generate()`), so `overtimeMinutes` on an existing
  `PayrollEntry`'s `timeLog` is by construction manager-approved overtime.
- `PayrollEntry` today has no bonus concept and no update path at all — the service
  comment states "PayrollEntry has no hand-authored create/update: read/delete +
  generate" and the permission catalog only defines `read`/`delete`/`generate` for the
  `payroll-entries` subject (`prisma/seed.ts:186-200`).
- Employee already holds a `read:payroll-entries` grant scoped to
  `{ employeeId: '$self' }` (`prisma/seed.ts:442-446`), and `findAll`/`findOne` already
  apply `accessibleWhere(ability, 'read', SUBJECT)`.

## Goals / Non-Goals

**Goals:**
- Let an Employee fetch a month-to-date earnings breakdown (shift pay / approved OT /
  bonus / total) for themselves in one request.
- Let an Employee see their most recently finalized pay period's paid total.
- Let a Manager/Admin set a discretionary bonus amount on a payroll entry.
- Keep the change additive: no behavior change to existing `generate`/`findAll`/`findOne`/
  `remove` semantics, no breaking DTO changes.

**Non-Goals:**
- Delivery income and pending-receipt approval — blocked on a separate, not-yet-started
  proposal.
- A bonus approval workflow (propose → approve). Bonuses are set directly by
  Manager/Admin, same trust boundary as `totalPay` itself.
- Retroactively backfilling a regular/OT split onto historical data — the split is
  computed on read, not stored.

## Decisions

### 1. Bonus: a plain field on `PayrollEntry`, set via a new authenticated update path

Add `bonus Decimal @db.Decimal(12, 2) @default(0)` to `PayrollEntry`. Rejected the
alternative (a separate `Bonus` model with its own approval workflow) because nothing in
the source proposal requires multi-step approval, and a second model would need its own
audit-log subject, permission rows, and reconciliation against `PayrollEntry` for no
functional gain at this scope — YAGNI until a real approval requirement shows up.

Because `generate()` creates one `PayrollEntry` per verified `TimeLog` with no bonus
input, bonus has to be settable after the fact. Add:

```
PATCH /payroll-entries/:id/bonus   { bonus: number }
```

gated by a new `update`/`payroll-entries` permission (Manager + Admin only, no `$self`
condition — employees never set their own bonus). This is a narrow endpoint (single
field) rather than a general `PATCH /payroll-entries/:id`, to avoid opening `totalPay`,
`payPeriodId`, etc. to hand-editing — those stay generate-only, preserving the existing
"no hand-authored create/update" invariant for every field except this new one.
`payroll-entries` is already an audited subject (`AuditLogsService.record` after
`generate`/`remove`); this endpoint must call it too (`before`/`after` around the
`bonus` field).

### 2. Regular vs. overtime split: computed on read from `TimeLog.overtimeMinutes`, not a new stored field

For each `PayrollEntry` in range, with its included `timeLog` (`actualStartTime`,
`actualEndTime`, `overtimeMinutes`):

```
hours       = (actualEndTime - actualStartTime) / MS_PER_HOUR
effRate     = totalPay / hours              // rate × multiplier, combined
otPay       = effRate × (overtimeMinutes ?? 0) / 60
shiftPay    = totalPay - otPay
```

Rejected deriving the split from `multiplier` alone (e.g. `totalPay / multiplier` as
"base pay") because `multiplier` is a generic pay-rate multiplier per its own field
description, not an OT-exclusivity flag — a future non-OT premium encoded via
`multiplier` would be wrongly counted as "approved OT". `overtimeMinutes` is the actual
manager-verified overtime signal and is already present on every eligible `TimeLog`, so
no migration is needed for this decision.

### 3. New aggregation endpoint, reusing the existing `read:payroll-entries` grant

```
GET /payroll-entries/summary?employeeId=&from=&to=
```

- `@RequirePermissions({ action: 'read', subject: 'payroll-entries' })` — same
  permission as `findAll`, no new grant. Row scoping reuses
  `accessibleWhere(ability, 'read', SUBJECT)`, so an Employee can only ever summarize
  their own `employeeId` (enforced the same way `findAll` already enforces it) and a
  Manager/Admin can summarize anyone in scope.
- `from`/`to` bound `workDate`; when omitted, default to the current calendar month.
- Response:
  ```
  {
    employeeId, from, to,
    shiftPay, approvedOt, bonus, total,
    previousPeriod: { payPeriodId, startDate, endDate, status, totalPaid } | null
  }
  ```
- `previousPeriod` is the most recent `PayPeriod` with `status: FINALIZED` that has at
  least one `PayrollEntry` for this employee, most recent `endDate` first; `totalPaid`
  sums `totalPay + bonus` across that employee's entries in that period. `null` when the
  employee has no finalized period yet.
- Rejected client-side aggregation (the proposal's other option): the regular/OT split
  in Decision 2 is nontrivial business logic (needs `overtimeMinutes` + duration math per
  entry) that would otherwise be duplicated on the frontend and drift if the split logic
  ever changes server-side.

## Risks / Trade-offs

- **[Risk]** Computing the OT split on every `summary` call re-derives per-entry math
  instead of reading a stored value → for a single employee's monthly entry volume
  (bounded by shifts/month) this is cheap; no pagination or caching needed at this scale.
- **[Risk]** A `PayrollEntry` whose `timeLog` has `actualStartTime`/`actualEndTime` both
  present but zero duration would divide by zero computing `effRate` → guard: treat
  `hours <= 0` as `otPay = 0, shiftPay = totalPay` (same defensive posture as `generate()`
  already takes for missing start/end times).
- **[Risk]** New `update`/`payroll-entries` permission needs a seed grant for Manager and
  Admin roles, and must NOT be granted to Employee → covered explicitly in tasks.md and
  the spec delta.
- **[Trade-off]** The bonus endpoint is scoped to only the `bonus` field rather than
  general entry editing. This is intentionally less flexible but keeps `totalPay`
  tamper-proof outside of `generate()`.

## Migration Plan

1. Prisma migration: add `bonus DECIMAL(12,2) NOT NULL DEFAULT 0` to `payroll_entries`.
   Purely additive — existing rows default to `0`, no backfill needed, no downtime.
2. Seed: add `update`/`payroll-entries` permission row; grant it to `Manager` and `Admin`
   roles only (no condition — same unscoped shape as their existing `delete`/`generate`
   grants on this subject).
3. Rollback: dropping the column and permission row is safe and reversible since no other
   code path reads `bonus` until this change's endpoints ship.

## Open Questions

None outstanding — bonus modeling and aggregation approach were the two open questions
carried from the proposal; both are resolved above.
