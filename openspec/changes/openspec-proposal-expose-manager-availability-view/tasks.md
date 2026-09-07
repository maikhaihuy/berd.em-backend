## 1. Seed data — authorization foundation

- [x] 1.1 In `prisma/seed.ts`, add the `SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION` constant (`{ subShift: { is: { masterShift: { is: { branchId: { in: '$managedBranches' } } } } } }`), alongside `SUB_SHIFT_MANAGED_BRANCH_CONDITION`/`TASK_MANAGED_BRANCH_CONDITION`.
- [x] 1.2 Remove `'availability'` from the `OPERATIONAL_SUBJECTS` array. (Also removed `'assignments'` — required to avoid `resolveGrants`'s duplicate-permission-grant guard once `assignments` gets its own explicit entry below; keeping it in both places would throw at seed time.)
- [x] 1.3 In `managerGrants`, replace the blanket `OPERATIONAL_SUBJECTS`-derived entry for `assignments` with an explicit grant: `{ subject: 'assignments', actions: CRUD, condition: SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION }`.
- [x] 1.4 In `managerGrants`, add a new read-only grant: `{ subject: 'availability', actions: ['read'], condition: SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION }`.
- [x] 1.5 Verify Employee's existing `availability` grant (`actions: ['read','create','update','delete']`, `condition: { employeeId: '$self' }`) is untouched. (Also added `assignments`/`availability` entries to `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS` in `permission-condition.helper.ts` so `GET /permissions/catalog` stays accurate per its own no-drift contract — not itemized in the original task list but required by CLAUDE.md's documented invariant.)
- [x] 1.6 Run `pnpm db:seed` against a local dev database and confirm no seed errors, then spot-check `RolePermission` rows for `Manager`/`availability`/`assignments` via `GET /permissions/catalog` or a direct query. (Seed completed cleanly; direct-query spot check confirmed Manager holds read-only `availability` and full-CRUD `assignments`, both scoped by the new relation condition, and Employee's `availability` grant is untouched.)

## 2. Service layer — `AvailabilityService`

- [x] 2.1 In `src/modules/availability/availability.service.ts`, change `findAll()`'s signature to drop `currentUserId` and add `ability: AppAbility`, `branchId?: number`, `subShiftId?: number`; replace the `getCurrentUserEmployee` self-filter with `accessibleWhere(ability, 'read', SUBJECT)` merged via a top-level `AND`, plus the optional `branchId`/`subShiftId` where clauses.
- [x] 2.2 Change `findOne()`'s signature to drop `currentUserId` and add `ability: AppAbility`; replace the self-filter with `accessibleWhere(ability, 'read', SUBJECT)`.
- [x] 2.3 Remove the now-unused `getCurrentUserEmployee` private helper if nothing else in the service calls it. (Still used by `create()`/`update()`, so kept as-is.)
- [x] 2.4 In `remove()`, add an instance-level CASL check — `ability.can('delete', subject(SUBJECT, availability))` — after loading the row by id, throwing `NotFoundException` (not `ForbiddenException`) when it fails; keep the existing audit-log call on successful delete.
- [x] 2.5 Confirm `update()`'s existing manual ownership check (`availability.employeeId !== employee.id`) is left as-is (out of scope for this change).

## 3. Controller layer

- [x] 3.1 In `src/modules/availability/availability.controller.ts`, add `@Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number` and `@Query('subShiftId', new ParseIntPipe({ optional: true })) subShiftId?: number` to the `GET /availability` handler; inject `@CaslAbility() ability: AppAbility` and drop `@AuthenticatedUser()` if no longer needed; pass all through to `findAll()`.
- [x] 3.2 Update the `GET /availability/:id` handler to inject `@CaslAbility() ability: AppAbility` (dropping `@AuthenticatedUser()` if unused) and pass it to `findOne()`.
- [x] 3.3 Update the `DELETE /availability/:id` handler to inject `@CaslAbility() ability: AppAbility` and pass it through to `remove()`.
- [x] 3.4 Update Swagger decorators/response docs on the three handlers if their query params or behavior description changed.

## 4. Unit tests

- [x] 4.1 In `src/modules/availability/availability.service.spec.ts`, update `findAll`/`findOne` test setup to mock an `ability` instead of an `Employee` lookup; add cases confirming cross-employee rows are returned when the ability's `accessibleWhere` allows it, and excluded when it doesn't. (Added `managerAbility()` helper with the `$managedBranches`-resolved condition; verified both a managed-branch grant and an empty-managed-branches grant.)
- [x] 4.2 Add a `findAll` test for the `branchId` filter and a test for the `subShiftId` filter, each combined with a mocked ability.
- [x] 4.3 Add `remove()` tests: denies a non-owning Employee (mocked ability returns `can() === false`) with `NotFoundException`; allows the owning Employee; allows Admin.
- [x] 4.4 Run `pnpm test availability.service` and confirm all pass. (10/10 passed.)

## 5. E2E tests

- [x] 5.1 Extend `rbac-multi-role-managed-branches.e2e-spec.ts` (or the closest existing managed-branch e2e spec) with: Manager A (manages Branch 1) lists Branch 1's availability successfully. (Added a new, focused spec `test/manager-availability-visibility.e2e-spec.ts` instead — mirrors the fixture style of `time-tracking-row-scoping.e2e-spec.ts`/`rbac-multi-role-managed-branches.e2e-spec.ts`, kept separate since availability's own coverage is substantial enough to warrant its own file.)
- [x] 5.2 Add a case: Manager A gets an empty list when querying `branchId` for Branch 2 (a branch they don't manage).
- [x] 5.3 Add a case: an Employee always sees only their own rows regardless of `branchId`/`subShiftId` query params.
- [x] 5.4 Add a case: Manager receives `403` on `POST`/`PATCH`/`DELETE /availability` after the seed change.
- [x] 5.5 Add a case: `DELETE /availability/:id` returns `404` for a non-owning Employee and succeeds for the owning Employee and for Admin.
- [x] 5.6 Run `pnpm test:e2e` and confirm the full e2e suite passes, not just the new/changed spec. (15/15 suites, 119/119 tests passed.)

## 6. Verification

- [x] 6.1 Run `pnpm lint` and `pnpm build` to confirm no type errors from the signature changes (call sites in the controller and any other consumers of `AvailabilityService.findAll`/`findOne`/`remove`). (`pnpm build` exits 0. `pnpm lint` reports 13 pre-existing errors/18 warnings, all in files untouched by this change — e.g. `auth.controller.ts`, shift/task mappers, `payroll-entry.service.ts`; the touched files carry only the same `no-unsafe-argument`-on-mocked-`AuditLogsService` warning already accepted throughout this codebase's other `*.service.spec.ts` files.)
- [x] 6.2 Manually exercise `GET /availability?date=&branchId=&subShiftId=` via `/docs` as both a seeded Manager and Employee test account to confirm the scoping and 404/403 behavior match the spec scenarios. (Exercised via real HTTP round trips against a running app instance in `test/manager-availability-visibility.e2e-spec.ts` instead of the Swagger UI — equivalent coverage, and repeatable: Manager scoping, Employee self-scoping, 403 on manager writes, and 404 on non-owning delete all verified live.)
- [x] 6.3 Confirm `GET /permissions/catalog` and `GET /users/:id/abilities` reflect the new `availability`/`assignments` Manager grants correctly (condition token visible, not the literal `"$self"`/`"$managedBranches"` string in resolved output). (Added `assignments`/`availability` to `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS` in `permission-condition.helper.ts`, which directly backs `GET /permissions/catalog` per `permission.service.ts`; `GET /users/:id/abilities` resolution of the new condition is exercised indirectly by every e2e assertion above, since a request only succeeds/scopes correctly if the underlying resolved `Ability` — the same object `/abilities` serializes — is correct. Direct-query spot check in task 1.6 also confirmed the raw `RolePermission.condition` values are the resolved token expressions, not literal placeholder strings.)
