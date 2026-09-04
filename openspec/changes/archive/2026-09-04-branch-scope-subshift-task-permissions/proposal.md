## Why

Follow-up to the already-merged `enforce-manager-branch-scoping` change (PR #49). That change
correctly scoped Manager's CRUD grants on `master-shift-templates`, `sub-shift-templates`,
`task-templates`, `master-shifts`, and `branch-schedule-configs` to `$managedBranches` — but
`sub-shifts` and `tasks` were deliberately left unconditioned in `prisma/seed.ts`, because
neither model carries a direct `branchId` column (only reachable transitively via
`sub-shift.masterShift.branchId` / `task.masterShift.branchId` or similar). This was documented
as a known Non-Goal in that change's `design.md`, not an oversight — but it means the exact class
of gap `enforce-manager-branch-scoping` was written to close still exists on two subjects: a
Manager can currently read/write `sub-shifts` and `tasks` belonging to branches they don't
manage.

The condition-resolution helper already supports at least one relation-based condition (used for
`employees`: `{ employeeBranches: { some: { branchId: { in: '$managedBranches' } } } }`), so the
mechanism to close this doesn't need to be invented — it needs to be extended to a second level
of relation traversal (`sub-shift`/`task` → `masterShift` → `branchId`) or confirmed that it
already supports that.

## What Changes

- Verify whether `src/common/guards/permission-condition.helper.ts`'s condition resolver
  supports a nested-relation condition like
  `{ masterShift: { branchId: { in: '$managedBranches' } } }` on `sub-shifts`/`tasks` out of the
  box (Prisma's `where` nesting generally does), or needs a small extension.
- Update `prisma/seed.ts`'s Manager grant for `sub-shifts` and `tasks` to carry that condition
  instead of being left unconditioned.
- Extend `test/rbac-multi-role-managed-branches.e2e-spec.ts` with a case for `sub-shifts`/`tasks`
  specifically, mirroring the existing seeded-role assertions added for the other subjects.

## Capabilities

### Modified Capabilities
- `managed-branch-scoping`: extends the existing scoping guarantee to `sub-shifts` and `tasks`,
  closing the two subjects intentionally deferred by the original change.

## Impact

`prisma/seed.ts`, `test/rbac-multi-role-managed-branches.e2e-spec.ts`, and possibly
`src/common/guards/permission-condition.helper.ts` if nested-relation conditions aren't already
supported. Same re-seed/backfill caveat as the original change: scoping an already-deployed DB's
role grants needs a migration/backfill step, not just a `seed.ts` edit.
