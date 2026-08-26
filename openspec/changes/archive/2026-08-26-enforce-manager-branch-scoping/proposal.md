_Priority: high (security)_

## Why
The `$managedBranches` condition mechanism for scoping Manager-role permissions to only their
assigned branches is implemented and covered by an e2e test
(`rbac-multi-role-managed-branches.e2e-spec.ts`) — but `prisma/seed.ts` grants the Manager role's
scheduling subjects (`master-shift-templates`, `sub-shift-templates`, `task-templates`,
`master-shifts`, `sub-shifts`, `tasks`, `branch-schedule-configs`) and `employees`/`branches`
without that condition. As shipped, any Manager can read and mutate every branch's data, not
just branches they manage — a real authorization gap in a system built specifically to support
branch-scoped managers.

## What Changes
- Update `prisma/seed.ts`'s Manager role grants to include
  `condition: { branchId: { in: '$managedBranches' } }` for all `branchId`-bearing scheduling
  subjects.
- For `employees` (no direct `branchId` field), scope via the relation-based condition the
  existing helper already supports:
  `{ employeeBranches: { some: { branchId: { in: '$managedBranches' } } } }`.
- **Found during pre-archive verification, not in the original scope**: setting the condition
  alone did nothing — `EmployeeService`, `BranchScheduleConfigService`,
  `MasterShiftTemplatesService`, `SubShiftTemplatesService`, and `TaskTemplatesService` had no
  `accessibleWhere`/CASL ability filtering in their `findAll`/`findOne` at all (only
  `master-shifts` did, from the earlier `rbac-multi-role-managed-branches` change). Wired
  `accessibleWhere(ability, 'read', <subject>)` into all five, mirroring the existing
  `master-shifts` pattern, so the seeded condition is actually enforced.
- Extend `rbac-multi-role-managed-branches.e2e-spec.ts` to assert the *seeded* (not just
  test-created) Manager role actually gets scoped access.

## Capabilities
**New:** (none)
**Modified:**
- `managed-branch-scoping` — seeded default role data now enforces the existing condition
  mechanism instead of leaving it unused.
- `authorization` — the "Row-scoped subjects apply CASL `accessibleBy` filters" requirement's
  enumerated subject list grows from `master-shifts` to also cover `employees`,
  `branch-schedule-configs`, `master-shift-templates`, `sub-shift-templates`, and
  `task-templates`.

## Impact
`prisma/seed.ts`, `test/rbac-multi-role-managed-branches.e2e-spec.ts`,
`src/common/guards/permission-condition.helper.ts`, and — for the query-level enforcement found
missing during verification — `src/modules/employees/employee.{service,controller}.ts`,
`src/modules/branch-schedule-configs/branch-schedule-config.{service,controller}.ts`,
`src/modules/master-shift-templates/master-shift-template.{service,controller}.ts`,
`src/modules/sub-shift-templates/sub-shift-template.{service,controller}.ts`,
`src/modules/task-templates/task-template.{service,controller}.ts`, and
`branch-schedule-config.service.spec.ts`. Flag as an open question
in `design.md`: re-seeding role grants on an already-deployed DB needs a migration/backfill
step, not just a `seed.ts` edit.
