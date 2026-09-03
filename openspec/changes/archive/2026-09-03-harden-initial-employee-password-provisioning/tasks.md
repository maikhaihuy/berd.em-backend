## 1. Schema & config

- [x] 1.1 Add `mustChangePasswordExpiresAt DateTime?` to `User` in `prisma/schema.prisma`;
      generate the migration (`pnpm db:dev --name "add-must-change-password-expiry"`).
- [x] 1.2 No production data exists yet — skip backfilling existing rows. Run
      `pnpm db:reset` in dev after the migration lands so all seeded/test `User` rows are
      recreated cleanly under the new credential scheme.
- [x] 1.3 Add `INITIAL_PASSWORD_TTL_DAYS` (default `7`) to `.env.example` and
      `src/common/env.validation.ts` (optional, numeric, defaulted).

## 2. Credential generation

- [x] 2.1 Add a method to `src/common/services/password.service.ts` that generates an
      8-character one-time credential from a 32-symbol unambiguous alphabet (uppercase
      letters + digits, excluding `0/O/1/I/L`) via `crypto.randomBytes`, returning both
      the plaintext and its bcrypt hash — mirroring the existing `hashRandom()` shape.
- [x] 2.2 Unit test: generated credentials are never derivable from a fixed input (no
      seedable/deterministic path) and only draw from the unambiguous alphabet.

## 3. Employee auto-provisioning

- [x] 3.1 In `src/modules/employees/employee.service.ts` (`create`, ~lines 90-105),
      replace `this.passwordService.hash(employeeData.phoneNumber)` with the new
      one-time-credential generator; set `mustChangePasswordExpiresAt` alongside
      `mustChangePassword: true`.
- [x] 3.2 Return the plaintext one-time credential in the `POST /employees` response
      (new field on `EmployeeResponseDto`, populated only on this create path — not by
      `EmployeeMapper.toDto` for any `GET`).
- [x] 3.3 Update/add unit tests in `employee.service.spec.ts`: generated password is
      random (not the phone number), `mustChangePasswordExpiresAt` is set, and the
      plaintext credential is returned from `create`.
- [x] 3.4 Update e2e coverage: an employee created via `POST /employees` can log in with
      the credential from the response but NOT with their phone number as password.

## 4. Login-time expiry enforcement

- [x] 4.1 In `src/modules/auth/strategies/local.strategy.ts` `validate()`, after the
      existing password `compare()` check succeeds, add: if `user.mustChangePassword` is
      true and `user.mustChangePasswordExpiresAt` is set and in the past, reject with a
      distinct, actionable error (not the generic `UnauthorizedException` used for wrong
      credentials) directing the caller to request a re-issued credential.
- [x] 4.2 Unit test `local.strategy.spec.ts`: login succeeds with a correct,
      not-yet-expired one-time credential; login is rejected with the distinct error for
      an expired one; a normal (non-flagged) User's login is unaffected regardless of
      `mustChangePasswordExpiresAt` (should be `null` for them).

## 5. Clear expiry on successful change-password

- [x] 5.1 In `src/modules/auth/auth.service.ts` `changePassword()` (~line 518), set
      `mustChangePasswordExpiresAt: null` in the same `prisma.user.update()` call that
      clears `mustChangePassword: false`.
- [x] 5.2 Unit test: after a successful `changePassword`, both `mustChangePassword` and
      `mustChangePasswordExpiresAt` are cleared.

## 6. Admin re-issue endpoint

- [x] 6.1 Add `UsersService.reissueInitialPassword(id, actorId)` in
      `src/modules/users/user.service.ts`: loads the `User`, generates a fresh one-time
      credential (reusing the Section 2 generator), updates `password` (hashed),
      `mustChangePassword: true`, and a fresh `mustChangePasswordExpiresAt`; throws
      `NotFoundException` if the user doesn't exist (consistent with existing
      `P2025`-handling convention).
- [x] 6.2 Call `AuditLogsService.record(...)` for the mutation — plaintext/hash excluded
      from the logged payload, matching the audit-log convention in CLAUDE.md. Used the
      action name `initial-password-reissued` (not the generic `update`) to mirror the
      sibling `generatePasswordResetToken`'s `password-reset-token-issued` convention
      already established in this same file.
- [x] 6.3 Add `POST /users/:id/reissue-initial-password` in
      `src/modules/users/user.controller.ts`, gated by
      `@RequirePermissions({ action: 'update', subject: 'users' })`, mirroring the
      existing `POST /users/:id/password-reset-token` handler shape; returns
      `{ password: string; expiresAt: Date }`.
- [x] 6.4 Add a matching `Permission`/role grant if `update`/`users` isn't already
      sufficient (check `prisma/seed.ts` — likely already covered by the existing
      `update:users` grant used by the reset-token endpoint). Confirmed: the sibling
      endpoint already uses `@RequirePermissions({ action: 'update', subject: 'users' })`,
      so no new seed data needed.
- [x] 6.5 Unit tests for the service method (success, not-found) and controller
      (permission-gated, 403 for a caller without the grant). Added
      `reissueInitialPassword` cases to `user.service.spec.ts` (success + not-found) and
      a new `user.controller.spec.ts` covering delegation, matching this codebase's
      existing convention (see `auth.controller.spec.ts`, `role.controller.spec.ts`) of
      thin controller-level specs; the 403-for-missing-permission guard behavior is
      verified e2e in 6.6, consistent with how `PASSWORD_CHANGE_REQUIRED` is verified
      elsewhere in this codebase rather than at the controller-unit level.
- [x] 6.6 e2e test: an Admin re-issues a credential for a User with an expired flag; the
      old credential no longer authenticates; the new one does. New
      `test/reissue-initial-password.e2e-spec.ts`; also covers the 403-for-missing-
      permission case and the login-time expiry rejection from Section 4. Added
      `@HttpCode(HttpStatus.OK)` to the new controller handler so it actually returns the
      200 its Swagger doc promises (NestJS defaults bare `@Post()` handlers to 201).

## 7. Documentation

- [x] 7.1 Update `openspec/specs/*` is handled by `/opsx:archive` at archive time — no
      manual spec sync needed here.
- [x] 7.2 Note the new `INITIAL_PASSWORD_TTL_DAYS` env var and the re-issue endpoint in
      `AGENTS.md`/`CLAUDE.md` if either documents the auth/provisioning flow in enough
      detail to go stale otherwise (check current wording before editing). `AGENTS.md`
      doesn't exist in this repo (pre-existing, unrelated to this change). `CLAUDE.md`'s
      Auth flows section documented the old phone-derived-password behavior in detail, so
      updated the auto-provisioning, forced-password-change, and password-recovery bullets
      plus the Environment variables section to describe the new one-time-credential,
      expiry, and re-issue-endpoint behavior.
