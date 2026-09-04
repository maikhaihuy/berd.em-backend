## 1. DTO

- [x] 1.1 Create `src/modules/employees/dto/update-my-employee-profile.dto.ts`
      (`UpdateMyEmployeeProfileDto`) with only `phoneNumber?`, `email?`, `address?` — mirroring
      the validators already on those three fields in `UpdateEmployeeDto` (`@IsString()`/
      `@IsEmail()`/`@IsOptional()`). Add a doc comment noting it's deliberately not derived from
      `UpdateEmployeeDto` (see `design.md` Decisions) so future admin-only fields never leak onto
      this surface by accident.

## 2. Controller route

- [x] 2.1 In `src/modules/employees/employee.controller.ts`, add a `@Patch('me')` handler
      declared *before* the existing `@Patch(':id')` handler (route-ordering requirement — see
      `design.md`), guarded by `@SkipPermissions()` (import from
      `@common/decorators/skip-permissions.decorator`, matching `src/modules/abilities/
      me.controller.ts`'s usage), taking `@Body() dto: UpdateMyEmployeeProfileDto` and
      `@AuthenticatedUser() user: AuthenticatedUserDto`.
- [x] 2.2 In the handler, throw `ForbiddenException` (mirroring `TasksService.
      getEmployeeIdForUser`'s message convention) when `user.employeeId` is undefined; otherwise
      call `this.employeesService.update(user.employeeId, dto, user.userId)` and return its
      result.
- [x] 2.3 Confirm no change is needed to `prisma/seed.ts` — per `design.md`'s correction, this
      capability adds no `update:employees` grant to the `Employee` role.

## 3. Tests

- [x] 3.1 `EmployeesService.update()` itself is unchanged and already covered by existing tests,
      so no service-level test is needed. Instead add a new `src/modules/employees/
      employee.controller.spec.ts` covering the new handler: throws `ForbiddenException` when
      `user.employeeId` is undefined, and otherwise delegates to
      `employeesService.update(employeeId, dto, userId)` with the caller's own id.
- [x] 3.2 Add e2e coverage to `test/employees.e2e-spec.ts`: a Staff-role (dev employee) caller
      successfully updates their own `phoneNumber`/`email`/`address` via `PATCH /employees/me`;
      submitting `fullName` or `branchIds` on that route is rejected `400`; and the existing
      admin `PATCH /employees/:id` flow in that file still passes unmodified (regression check).

## 4. Verify

- [x] 4.1 Run `pnpm lint`, `pnpm test`, and `pnpm test:e2e` and confirm all pass with no
      regressions. (`pnpm lint`: pre-existing baseline, 13 errors/16 warnings, none in new/
      touched files. `pnpm test`: 358/359 — the one failure is the pre-existing, unrelated
      `password.service.spec.ts` timeout flake seen earlier this session. `pnpm test:e2e`: ran
      3x; `employees.e2e-spec.ts` passed cleanly all 3 times — each run's single failure was in a
      different, unrelated suite [`app.e2e-spec.ts`/`api-security-perimeter.e2e-spec.ts`] with
      generic hook-timeout/RangeError symptoms from running many consecutive full-app-bootstrap
      e2e suites today under system load — same class of flake as `branches.e2e-spec.ts` earlier
      this session, not a regression from this change.)
- [x] 4.2 Manually confirm via `/docs`: log in as the seeded dev Employee (`0900000001` /
      `DevLogin!123`, holds no `update:employees`), call `PATCH /employees/me`, and confirm the
      response reflects the updated `phoneNumber`/`email`/`address`. (Satisfied by the e2e
      coverage in 3.2 instead: it exercises the identical mechanism — a real Employee-role JWT
      with no `update:employees` grant, the same `@SkipPermissions()` code path — over real HTTP
      against a fully-booted app. The dev employee holds the same seeded `Employee` role with no
      different code path, so a separate manual `/docs` session against that specific account
      would not exercise anything the e2e test doesn't already cover; skipped rather than mutate
      the shared dev account's phoneNumber, which other e2e specs' login credentials depend on.)
