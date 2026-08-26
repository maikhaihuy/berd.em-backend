## 1. Seed: scope Manager's scheduling-subject grants

- [x] 1.1 In `prisma/seed.ts`, add `condition: { branchId: { in: '$managedBranches' } }` to the `managerGrants` entry (or entries) covering `branch-schedule-configs`, `master-shift-templates`, `sub-shift-templates`, `task-templates`, and `master-shifts`. Split these out of the current single `SCHEDULING_SUBJECTS.map(...)` line into their own `resolveGrants` entries so `sub-shifts` and `tasks` (no direct `branchId`) stay unconditioned.
- [x] 1.2 Update the comment block above `managerGrants` to note which scheduling subjects are branch-scoped and why `sub-shifts`/`tasks` are excluded (no direct `branchId`; see design.md Non-Goals).

## 2. Seed: scope Manager's `employees` grant

- [x] 2.1 In `prisma/seed.ts`, add `condition: { employeeBranches: { some: { branchId: { in: '$managedBranches' } } } }` to the `managerGrants` entry for `{ subject: 'employees', actions: ['create', 'read', 'update'] }`.
- [x] 2.2 Add a short comment noting the condition scopes `read`/`update` query filtering but has no effect on `create` (no instance-level ability check exists in `EmployeeService.create`), per design.md's Non-Goals/Risks.

## 3. Catalog documentation

- [x] 3.1 In `src/common/guards/permission-condition.helper.ts`, add an `employees: ['employeeBranches.branchId']` entry to `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS` so `GET /permissions/catalog` reflects the new grant.

## 4. Re-seed and manually verify

- [x] 4.1 Run `pnpm db:reset` (or `db:seed` against a dev database) and confirm it completes without error.
- [x] 4.2 Query the seeded `Manager` role's `RolePermission` rows (e.g. via `GET /role-permissions/role/:roleId` as an admin, or a Prisma Studio check) and confirm `condition` is set on `master-shifts`, `master-shift-templates`, `sub-shift-templates`, `task-templates`, `branch-schedule-configs`, and `employees`, and still absent on `sub-shifts`, `tasks`, and `branches`.

## 5. Extend e2e coverage

- [x] 5.1 In `test/rbac-multi-role-managed-branches.e2e-spec.ts`, add a new `describe` block that fetches the seeded `Manager` role's id (`GET /roles`, filter by `name === 'Manager'`), creates a test user assigned that role, and asserts via `GET /users/:id/abilities` that the `master-shifts` and `employees` rules carry the expected `$managedBranches`-resolved `conditions` (empty-list case with no `ManagerBranch` rows, then the assigned-branch-id case after `POST /users/:id/manager-branches`).
- [x] 5.2 Add cleanup (`afterAll`/`afterEach`) for any new user/branch fixtures created in 5.1, following the existing file's pattern.
- [x] 5.3 Run `pnpm test:e2e` (requires a reachable, seeded `DATABASE_URL`) and confirm the new and existing specs pass.

## 6. Regression check

- [x] 6.1 Run `pnpm test` (unit suite) to confirm no existing spec asserts the old unconditioned Manager grants (e.g. any test fixture that logs in as Manager and expects to see another branch's data).
- [x] 6.2 Run `pnpm lint` and `pnpm build`.
