## 1. Plain-CRUD unit specs (branches, employee-hourly-rates)

- [x] 1.1 Create `src/modules/branches/branch.service.spec.ts` (direct-construction,
      plain-Prisma-mock pattern from `branch-schedule-config.service.spec.ts`): `create`
      (success, P2002 duplicate name/abbreviation → `BadRequestException`), `findAll`, `findOne`
      (success, not-found), `update` (success, P2025 → `NotFoundException`), `remove` (success,
      P2025 → `NotFoundException`).
- [x] 1.2 Create `src/modules/employee-hourly-rates/employee-hourly-rates.service.spec.ts` with
      the same shape: `create` (success, P2025 unknown employee → `NotFoundException`), `findAll`,
      `findOne` (success, not-found), `update` (success, P2025 → `NotFoundException`), `remove`
      (success, P2025 → `NotFoundException`).

## 2. Ability-scoped unit specs (templates + master-shifts)

- [x] 2.1 Create `src/modules/master-shift-templates/master-shift-template.service.spec.ts`:
      `create` (success, branch-not-found, time-range validation), `findAll`/`findOne` scoped by
      an `unscopedAbility` and a managed-branch-conditioned ability (assert
      `accessibleWhere(ability, 'read', 'master-shift-templates')` is merged into the Prisma
      `where`, per `design.md`), `update` (branch-template-match validation), `remove`
      (not-found).
- [x] 2.2 Create `src/modules/sub-shift-templates/sub-shift-template.service.spec.ts` with the
      same shape, covering `ensureBranchAndMasterTemplate`'s branch-mismatch validation and
      `validateTimeRange`.
- [x] 2.3 Create `src/modules/task-templates/task-template.service.spec.ts` with the same shape,
      covering `validateScope`'s `DEDICATED` vs shared branching (target-type/branch-mismatch
      validation).
- [x] 2.4 Create `src/modules/master-shifts/master-shift.service.spec.ts` with the same shape,
      covering `create`/`update` branch-template-match and time-range validation, `findAll`/
      `findOne` ability scoping, and `generateFromTemplate`'s master-shift + sub-shift + task
      fan-out (mock `$transaction` to invoke its callback, assert the created rows' shape).

## 3. Extend existing partial specs

- [x] 3.1 Extend `src/modules/employees/employee.service.spec.ts` (reuse its existing
      `Test.createTestingModule` DI scaffold): add `findAll`/`findOne` (ability-scoped
      via `accessibleWhere`, plus not-found for `findOne`), `update` (duplicate-phone rejection,
      branch resync), `remove` (not-found), and `syncHourlyRates` (create-only, update-only,
      delete-only, and mixed create+update+delete diff cases, asserting the `$transaction`
      callback's calls).
- [x] 3.2 Extend `src/modules/sub-shifts/sub-shift.service.spec.ts`: add `create` (master-shift
      not-found, sub-shift-template branch-mismatch, time-range validation), `update`, and
      `remove` (not-found).

## 4. Dedicated e2e coverage

- [x] 4.1 Create `test/branches.e2e-spec.ts` (structured like
      `test/branch-schedule-config.e2e-spec.ts`): full CRUD over real HTTP as an admin — create,
      list, get-by-id, update, delete — plus duplicate name/abbreviation rejection (`400`) and
      get/delete of a non-existent id (`404`). (Finding: `Branch` has no `@unique`/`@@unique` on
      `name`/`abbreviation` in the schema, so `BranchesService.create`'s P2002-catch is currently
      unreachable — the e2e test documents actual behavior [a duplicate succeeds] instead, per
      this change's no-behavior-change scope; fixing the schema is a separate change.)
- [x] 4.2 Create `test/employees.e2e-spec.ts`: full CRUD over real HTTP — create (asserting the
      auto-provisioned `User`/`temporaryPassword` response shape per `CLAUDE.md`'s Auth flows),
      list, get-by-id, update (branch reassignment), delete — plus duplicate-phone rejection on
      create (`400`/`FieldValidationException` shape) and get/delete of a non-existent id (`404`).

## 5. Verify

- [x] 5.1 Run `pnpm lint` and `pnpm test` and confirm every new/extended spec passes with no
      regressions elsewhere. (`pnpm lint`: back to the exact pre-existing baseline of 13
      errors/16 warnings, none in new/extended files, after adding the same top-of-file
      `eslint-disable @typescript-eslint/no-unsafe-assignment` convention already used elsewhere
      in this codebase's specs. `pnpm test`: 357/357 pass, up from 265 at session start.)
- [x] 5.2 Run `pnpm test:e2e` and confirm the two new e2e specs pass alongside the existing suite.
      (13/13 suites, 93/93 tests pass, up from 11/75 at session start.)
