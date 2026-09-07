## Why

Cross-repo dependency check: the frontend's `build-income-overview-and-shift-earnings-tabs`
proposal (Thu nhập → Tổng quan + Tiền ca) needs employee-facing read access to payroll data,
including a bonus category and month-to-date category breakdown. Checked against current backend
code:

- **Tiền ca (shift earnings list) is already Ready**: Employee has `read:payroll-entries` scoped
  `{ employeeId: '$self' }` (`prisma/seed.ts:412-416`), and `GET /payroll-entries?employeeId=` is
  properly ability-scoped (`payroll-entry.controller.ts:47-64`). No backend change needed for
  this sub-tab.
- **Gap 1 — no employee access to `pay-periods`**: Employee has zero grant on the `pay-periods`
  subject anywhere in `employeeGrants`. Tổng quan needs "latest paid amount from the previous
  payroll period," which needs period metadata (dates, status) — check first whether
  `PayrollEntryResponseDto` already nests enough `payPeriod` data to answer this without a
  separate grant (cheaper fix if so); only add a scoped `read:pay-periods` grant if the nested
  data genuinely isn't enough.
- **Gap 2 — no bonus concept anywhere in the data model**: `grep -rin bonus` across
  `prisma/schema.prisma` and `src/modules` returns zero hits. `PayrollEntry`
  (`schema.prisma:660-681`) has no bonus field. CLAUDE.md's spec explicitly lists "Bonus (thưởng)"
  as one of the 4 earnings-breakdown categories — it currently has no backend representation at
  all, unlike OT which is tracked via `TimeLog.multiplier`/`overtimeMinutes`.
- **Gap 3 — no aggregation endpoint**: only raw list/get exists on `payroll-entries`; there's no
  "my earnings this month broken down by category" summary endpoint. The frontend would have to
  fetch raw entries and aggregate client-side, which may be fine for a single employee's monthly
  volume but is worth deciding deliberately rather than defaulting into it.

## What Changes

- **Resolved — Gap 1**: confirmed `PayrollEntryResponseDto` already nests `payPeriod`
  (`id`, `status`, `startDate`, `endDate`) via `payrollEntryInclude`. No new
  `read:pay-periods` grant is needed for "previous period" data.
- **Resolved — bonus modeling**: add a simple `bonus` amount field on `PayrollEntry`
  (mirrors how OT already piggybacks on `TimeLog`), not a separate `Bonus` model —
  bonuses don't need their own approval workflow, and stay in the same trust boundary as
  `totalPay` (Manager/Admin-set). See `design.md` Decision 1 for the update path, since
  `PayrollEntry` has no existing hand-authored update endpoint.
- **Resolved — aggregation approach**: add a server-side summary endpoint,
  `GET /payroll-entries/summary?employeeId=&from=&to=`, rather than client-side
  aggregation — the regular/OT split (`design.md` Decision 2) is nontrivial logic best
  kept in one place. See `design.md` Decision 3 for the response shape.
- Delivery income and pending-approval-receipts in the Tổng quan breakdown remain blocked on the
  still-not-started `add-delivery-receipt-ocr-approval` backend proposal — out of scope here,
  don't try to stub it.

## Capabilities

### New Capabilities
- `employee-earnings-summary`: an Employee can see their own month-to-date earnings broken down
  by category (shift pay, approved OT, bonus — delivery income once that proposal lands) and
  their most recent paid amount, without Admin/Manager involvement.

### Modified Capabilities
- `payroll-entries-crud`: `PayrollEntry` gains a `bonus` field and a
  Manager/Admin-only `PATCH /payroll-entries/:id/bonus` endpoint to set it.

## Impact

`prisma/schema.prisma` (`bonus` field + migration), `prisma/seed.ts` (new
`update:payroll-entries` permission, granted to Manager/Admin only),
`src/modules/payroll-entries/` (bonus endpoint + new summary endpoint and DTOs).
No changes needed to `src/modules/pay-periods/` — see Gap 1 resolution above.

See `design.md` for the full set of technical decisions (bonus modeling, the
regular/OT split, and the summary endpoint's response shape).
