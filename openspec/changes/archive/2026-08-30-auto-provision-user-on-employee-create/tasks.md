## 1. Schema migration

- [x] 1.1 Add `mustChangePassword Boolean @default(false)` to `User` in
      `prisma/schema.prisma`
- [x] 1.2 Run `pnpm db:dev --name "add-user-must-change-password"` to generate and apply
      the migration

## 2. Employee + User atomic provisioning

- [x] 2.1 In `src/modules/employees/employee.service.ts`, wrap `EmployeesService.create`'s
      body in `prisma.$transaction(async (tx) => { ... })`
- [x] 2.2 Inside the transaction, check `tx.user.findUnique({ where: { phoneNumber } })`
      before any writes; if found, throw `FieldValidationException('phoneNumber', ...)`
      identifying that a User with that phone number already exists
- [x] 2.3 Resolve the seeded `Employee` role via
      `tx.role.findFirstOrThrow({ where: { name: 'Employee' } })`
- [x] 2.4 Create the `User` via `tx.user.create(...)`: `phoneNumber` = employee's phone,
      `fullName` = employee's full name, `password` = `PasswordService.hash(phoneNumber)`,
      `status: ACTIVE`, `mustChangePassword: true`, `userRoles: { create: [{ roleId }] }`
      (also records an `AuditLogsService` entry for the `users` subject, per the
      project-wide audited-mutation convention in CLAUDE.md)
- [x] 2.5 Create the `Employee` via `tx.employee.create(...)` with `userId` set to the new
      User's id, keeping the existing `employeeWithBranchesInclude` include and branch
      handling unchanged
- [x] 2.6 Extend the existing `P2002` catch block to also translate a `User.phoneNumber`
      unique-constraint violation into `FieldValidationException` (race-condition backstop
      per design.md Decision 3), alongside the existing `Employee.phoneNumber` handling
      (the existing `uniqueConstraintFields` helper is already column-name-generic, so no
      code change was needed beyond keeping it in the transaction's catch scope)
- [x] 2.7 Confirm `CreateEmployeeDto` has no `password` field (none should be added)

## 3. Forced password change - backend enforcement

- [x] 3.1 Add `mustChangePassword: boolean` to `AuthenticatedUserDto`
      (`src/modules/auth/dto/authenticated-user.dto.ts`)
- [x] 3.2 Populate it in `JwtAccessStrategy.validate()`
      (`src/modules/auth/strategies/jwt-access.strategy.ts`) from the freshly-queried
      `user.mustChangePassword`
- [x] 3.3 Add an `@AllowWhilePasswordChangeRequired()` decorator (same shape as
      `@SkipPermissions()`) under `src/common/decorators/`
- [x] 3.4 Create `ForcePasswordChangeGuard` in
      `src/modules/auth/guards/force-password-change.guard.ts`: passes through on
      `@Public()`, passes through if `request.user` is absent, passes through on
      `@AllowWhilePasswordChangeRequired()`, otherwise throws `ForbiddenException` with a
      `PASSWORD_CHANGE_REQUIRED` code when `request.user.mustChangePassword === true`
- [x] 3.5 Register `ForcePasswordChangeGuard` as `APP_GUARD` in
      `src/common/authz.module.ts`, positioned after `JwtAccessGuard` and before
      `PermissionsGuard`

## 4. `POST /auth/change-password` endpoint

- [x] 4.1 Add `ChangePasswordDto` (`currentPassword: string`, `newPassword: string`) under
      `src/modules/auth/dto/`
- [x] 4.2 Add `AuthService.changePassword(userId, dto)`: load the User, verify
      `currentPassword` via `PasswordService.compare` (reject with an error if it doesn't
      match, regardless of `mustChangePassword`), then hash and persist `newPassword` and
      set `mustChangePassword: false` via `prisma.user.update(...)`
- [x] 4.3 Add `POST /auth/change-password` to `auth.controller.ts`: authenticated (default
      `JwtAccessGuard`), `@SkipPermissions()`, `@AllowWhilePasswordChangeRequired()`
      (also added `@AllowWhilePasswordChangeRequired()` to `POST /auth/logout-all`, the
      other route in the design.md Decision 4 allowlist that actually runs through
      `JwtAccessGuard`)
- [x] 4.4 Add Swagger annotations consistent with the other routes in
      `auth.controller.ts`

## 5. Tests

- [x] 5.1 Unit test `EmployeesService.create`: auto-provisions a User when phone number is
      free (asserts hashed password, `Employee` role, `mustChangePassword: true`, linked
      `userId`)
- [x] 5.2 Unit test `EmployeesService.create`: rejects with `FieldValidationException` when
      a `User` with that phone number already exists, and creates no `Employee`
- [x] 5.3 Unit test `ForcePasswordChangeGuard`: blocks a flagged user on a non-exempt route,
      allows `@Public()`, allows `@AllowWhilePasswordChangeRequired()`
- [x] 5.4 Unit test `AuthService.changePassword`: succeeds and clears the flag on correct
      `currentPassword`; rejects and leaves state unchanged on incorrect `currentPassword`
- [x] 5.5 E2E test: create an Employee, log in as the auto-provisioned User, confirm
      non-exempt routes 403 with `PASSWORD_CHANGE_REQUIRED`, call
      `POST /auth/change-password`, confirm subsequent requests succeed normally
      (`test/auto-provision-user-on-employee-create.e2e-spec.ts` — also caught and fixed a
      real bug: `GlobalExceptionFilter` doesn't forward an arbitrary `code` field, so the
      guard now carries the code in `details.code` instead; see design.md's updated
      Decision 4)

## 6. Documentation

- [x] 6.1 Update `CLAUDE.md` / `AGENTS.md` Auth flows section to describe auto-provisioning
      and the forced-password-change gate, keeping both files in sync (`AGENTS.md` does not
      actually exist in this repo despite CLAUDE.md's claim it's kept in sync — a
      pre-existing gap, not something introduced or fixed by this change; only `CLAUDE.md`
      was updated)
