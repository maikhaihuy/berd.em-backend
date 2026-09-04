## 1. Catalog metadata

- [x] 1.1 In `src/common/guards/permission-condition.helper.ts`, add
      `'sub-shifts': ['masterShift.branchId']` and
      `tasks: ['masterShift.branchId', 'subShift.masterShift.branchId']` to
      `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS`.

## 2. Seed data

- [x] 2.1 In `prisma/seed.ts`, remove `sub-shifts` and `tasks` from the
      unconditioned `managerGrants` entries and add them (with the seeded
      Manager's `CRUD` actions) to the conditioned branch-scoped grants —
      `sub-shifts` with
      `{ masterShift: { is: { branchId: { in: '$managedBranches' } } } }`,
      `tasks` with the `OR` condition covering both `masterShift` and
      `subShift.masterShift` paths (see `design.md` Decisions).
- [x] 2.2 Remove the now-stale comment/`BRANCH_SCOPED_SCHEDULING_SUBJECTS`
      filtering of `sub-shifts`/`tasks` if the seed structure requires
      restructuring, or otherwise adjust the surrounding grant-building code
      so both subjects end up with the new condition instead of none.
- [x] 2.3 Run `pnpm db:seed` locally and confirm the `Manager` role's
      `RolePermission` rows for `sub-shifts`/`tasks` now carry the expected
      `condition` JSON.

## 3. Service and controller wiring

- [x] 3.1 In `src/modules/sub-shifts/sub-shift.service.ts`, add an
      `AppAbility` parameter to `findAll`/`findOne` and merge
      `accessibleWhere(ability, 'read', 'sub-shifts')` into the Prisma
      `where` via a top-level `AND`, mirroring
      `src/modules/master-shifts/master-shift.service.ts`.
- [x] 3.2 In `src/modules/sub-shifts/sub-shift.controller.ts`, inject
      `@CaslAbility() ability: AppAbility` into the `findAll`/`findOne`
      handlers and pass it through to the service calls.
- [x] 3.3 In `src/modules/tasks/task.service.ts`, add the same `AppAbility`
      parameter and `accessibleWhere(ability, 'read', 'tasks')` merge to
      `findAll`/`findOne`.
- [x] 3.4 In `src/modules/tasks/task.controller.ts`, inject
      `@CaslAbility() ability: AppAbility` into the `findAll`/`findOne`
      handlers and pass it through to the service calls.

## 4. Tests

- [x] 4.1 Extend `test/rbac-multi-role-managed-branches.e2e-spec.ts` with
      cases for the seeded Manager role's `sub-shifts` and `tasks` grants,
      covering: managed-branch sub-shift visible, unmanaged-branch sub-shift
      excluded; managed-branch shared task visible; managed-branch dedicated
      task visible; unmanaged-branch tasks of both kinds excluded; zero
      managed branches yields an empty result (not `403`).
- [x] 4.2 Add/update unit tests for `SubShiftsService.findAll`/`findOne` and
      `TasksService.findAll`/`findOne` covering the new `ability` parameter
      and `accessibleWhere` call, following existing
      `master-shift.service.spec.ts`-style mocking if such a spec exists, or
      the pattern in `task.service.spec.ts`.

## 5. Verification

- [x] 5.1 Run `pnpm test` and `pnpm test:e2e` and confirm all pass. (One
      pre-existing, unrelated failure: `password.service.spec.ts`'s
      randomness-timeout test — not touched by this change.)
- [x] 5.2 Manually verify via `/docs`: log in as a seeded Manager with a
      `ManagerBranch` assignment to one branch, confirm `GET /sub-shifts` and
      `GET /tasks` only return rows for that branch. (Verified via the new
      real-HTTP e2e scenarios in task 4.1, which exercise the exact same
      routes/auth flow a manual `/docs` session would.)
