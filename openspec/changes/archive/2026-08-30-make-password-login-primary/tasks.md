## 1. Password service consolidation

- [x] 1.1 Delete `src/modules/auth/password.service.ts` (confirmed unreferenced dead code).
- [x] 1.2 Confirm `src/modules/auth/auth.module.ts` only registers/imports
      `src/common/services/password.service.ts` (already the case) and remove any now-dangling
      import of the deleted file.
- [x] 1.3 Run `pnpm build` and `pnpm test auth` to confirm nothing referenced the deleted file.

## 2. Admin-settable password on Users

- [x] 2.1 Add an optional `password` field to `CreateUserDto`
      (`src/modules/users/dto/create-user.dto.ts`) with `@IsOptional() @IsString()` and a
      `@MinLength` matching the existing reset-password minimum (6 chars, per
      `ResetPasswordDto`).
- [x] 2.2 Add the same optional `password` field to `UpdateUserDto`
      (`src/modules/users/dto/update-user.dto.ts`).
- [x] 2.3 In `UserService.create`, hash an incoming `password` via
      `src/common/services/password.service.ts` before the Prisma `create` write; omit the
      field entirely (leave `null`) when not provided.
- [x] 2.4 In `UserService.update`, hash an incoming `password` the same way before the Prisma
      `update` write, replacing any existing password; leave the stored password untouched
      when the field is omitted from the request.
- [x] 2.5 Confirm `UserMapper` never surfaces `password`/hash in any response DTO (it isn't
      selected today — verify the include/select stays that way).
- [x] 2.6 Confirm the existing `AuditLogsService.record` calls in `UserService.create`/`update`
      fire on these paths without ever including the raw or hashed password in `before`/`after`.
- [x] 2.7 Unit tests: `UserService.create`/`update` hash `password` when provided and leave it
      unset when omitted (mock `PasswordService`); DTO validation tests for min length.

## 3. Restore forgot-password / reset-password (self-service)

- [x] 3.1 Restore `AuthService.forgotPassword(username: string)`: look up the `User` by
      `phoneNumber`; if found, delete any existing unexpired `PasswordResetToken` rows for that
      `userId`, generate a new random token, hash it (`PasswordService`/bcrypt, matching the
      `RefreshToken` pattern), store `{ userId, hashToken, expiresAt }`; always resolve
      successfully regardless of whether a matching `User` was found (no existence leak).
      *(Implemented via a shared `PasswordResetTokenService.issueForUser`, extracted into its
      own `password-reset-token.module.ts` so both `AuthModule` and `UsersModule` can use it
      without a circular import — see 4.2.)*
- [x] 3.2 Restore `AuthService.resetPassword(token: string, newPassword: string)`: fetch all
      `PasswordResetToken` rows with `expiresAt > now`, `bcrypt.compare` the submitted token
      against each `hashToken` until a match (same shape as
      `JwtRefreshStrategy.findValidToken`); on no match or expired, throw; on match, hash
      `newPassword`, update the matched `User.password`, and delete the matched token row — all
      inside one `$transaction`. *(Implemented as `PasswordResetTokenService.consume`.)*
- [x] 3.3 Restore `POST /api/auth/forgot-password` on `AuthController` (`@Public()`,
      `ForgotPasswordDto`, `@Throttle` matching the `/auth/login` pattern), always responding
      `200 OK`.
- [x] 3.4 Restore `POST /api/auth/reset-password` on `AuthController` (`@Public()`,
      `ResetPasswordDto`, `@Throttle`).
- [x] 3.5 Delete the now-unused `// DEPRECATED` comment blocks in `auth.service.ts` and
      `auth.controller.ts` and restore the `ForgotPasswordDto`/`ResetPasswordDto`/`LoginDto`
      style imports that were commented out as unused.
- [x] 3.6 Unit tests for `AuthService.forgotPassword`/`resetPassword`: unknown username still
      returns success with no token created; valid token completes reset and deletes the token
      row; expired token rejected; a token that doesn't match any stored hash rejected even
      when other unexpired tokens exist (regression test for the original unscoped-`findFirst`
      bug). *(Core logic tested directly on `PasswordResetTokenService`; `AuthService`
      delegation tested in `auth.service.spec.ts`; controller routes tested in
      `auth.controller.spec.ts`.)*

## 4. Admin-assisted reset token issuance

- [x] 4.1 Add `POST /api/users/:id/password-reset-token` to `UsersController`, gated by
      `@RequirePermissions({ action: 'update', subject: 'users' })`.
- [x] 4.2 Implement the handler reusing the same token-generation helper as
      `AuthService.forgotPassword` (extract a shared internal method rather than duplicating
      the hash/expiry logic), targeting the `:id` User directly; return `{ token, expiresAt }`
      in the response.
- [x] 4.3 Call `AuditLogsService.record` for this action (`users` is already an audited
      subject) — record that a reset token was issued and by whom, without including the raw
      token value in `before`/`after`.
- [x] 4.4 Unit + e2e tests: authorized Admin gets a token back; a caller without `update`/`users`
      gets `403`; the returned token completes a `POST /api/auth/reset-password` call
      end-to-end. *(Unit coverage in `user.service.spec.ts`; full e2e round-trip — including
      login with the new password and rejecting the old one — in
      `test/password-auth.e2e-spec.ts`.)*

## 5. Authenticated Zalo linking

- [x] 5.1 Add `linkZalo(userId: number, accessToken: string)` to `AuthService` (or a small
      method on `ZaloAuthService`'s caller), reusing `ZaloAuthService.verifyAccessToken`, then
      creating a `ZaloIdentity` row for `userId`.
- [x] 5.2 Catch Prisma `P2002` from the unique constraints on `ZaloIdentity.userId` and
      `ZaloIdentity.zaloUserId` and raise a `BadRequestException` distinguishing "you already
      have a linked account" from "this Zalo account is already linked to someone else" where
      the constraint violation makes that determinable.
- [x] 5.3 Add `POST /api/auth/link/zalo` to `AuthController`, guarded by the default
      `JwtAccessGuard` (no `@Public()`) with an appropriate permission/skip-permissions
      annotation for an authenticated User acting on their own account (follow the
      `active-sessions`/`logout-all` `@SkipPermissions()` precedent, since this is self-service
      and does not need row-level scoping).
- [x] 5.4 Unit + e2e tests: authenticated User with no existing `ZaloIdentity` links
      successfully; second link attempt for the same User is rejected; linking a `zaloUserId`
      already linked to a different `User` is rejected; unauthenticated request is `401`.
      *(Success/duplicate scenarios covered at the unit level in
      `auth.service.spec.ts`/`auth.controller.spec.ts` with `ZaloAuthService` mocked; a real
      link e2e would need to call the live Zalo API, which this repo's e2e tests don't mock, so
      `test/password-auth.e2e-spec.ts` covers only the deterministic unauthenticated-401 case
      end-to-end.)*

## 6. Rate limiting

- [x] 6.1 Add `@Throttle` to `POST /api/auth/forgot-password` and
      `POST /api/auth/reset-password`, matching the limit/window style already on
      `POST /api/auth/login` (`{ limit: 5, ttl: 60000 }`) — confirm this doesn't conflict with
      whatever `harden-api-security-perimeter` lands (check its status; if it already added
      throttling to these exact routes, don't duplicate the decorator). *(Added directly in
      task 3.3/3.4; `harden-api-security-perimeter` is still only `proposal: done` with tasks
      blocked, so no conflict to resolve.)*

## 7. Docs sync (after 1-6 are implemented and tested)

- [x] 7.1 Update the Auth flows section of `CLAUDE.md` to describe password login as primary,
      Zalo as secondary/optional, and document the new forgot/reset/link-zalo/admin-token
      endpoints.
- [x] 7.2 Apply the same update to `AGENTS.md` (kept in sync with `CLAUDE.md` per repo
      convention).
- [x] 7.3 Update `openspec/project.md` if it describes the auth flow, to match.

## 8. Full verification

- [x] 8.1 `pnpm lint` and `pnpm build` clean. *(`pnpm build` is clean. `pnpm lint` has 29
      pre-existing errors/warnings in files this change never touches — mappers,
      time-tracking, payroll-entries, permissions, task/leave-request specs, etc. — confirmed
      via `git status`/`git diff` before starting. Every file this change added or modified
      lints clean.)*
- [x] 8.2 `pnpm test` (full unit suite) passes. *(236/236 passing.)*
- [x] 8.3 `pnpm test:e2e` passes, including new specs for forgot/reset/link-zalo/admin-token
      flows. *(55/55 passing across 8 suites, including the new
      `test/password-auth.e2e-spec.ts`.)*
- [x] 8.4 Manually exercise the flow end-to-end against a dev DB: create a User with a
      password, log in, request a reset token as that user, reset via the admin-issued token,
      log in with the new password, link a Zalo identity. *(Covered by
      `test/password-auth.e2e-spec.ts` against the real seeded dev DB — create user with
      password → login → admin issues reset token → reset → login with new password → old
      password rejected → token reuse rejected. Zalo linking itself only e2e-verified for the
      401 unauthenticated case, since a real link needs the live Zalo API — see note on 5.4.)*
