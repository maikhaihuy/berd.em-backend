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
- Extend `rbac-multi-role-managed-branches.e2e-spec.ts` to assert the *seeded* (not just
  test-created) Manager role actually gets scoped access.

## Capabilities
**New:** (none)
**Modified:** `managed-branch-scoping` — seeded default role data now enforces the existing
condition mechanism instead of leaving it unused.

## Impact
`prisma/seed.ts`, `test/rbac-multi-role-managed-branches.e2e-spec.ts`. Flag as an open question
in `design.md`: re-seeding role grants on an already-deployed DB needs a migration/backfill
step, not just a `seed.ts` edit.
