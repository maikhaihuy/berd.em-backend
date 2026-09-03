## Why

`berd.em-frontend`'s forced-password-change gate is implemented and merged, but inert: it decodes the access token client-side (there is no `/auth/me`) looking for a `mustChangePassword` claim that the token never carries, and it matches a defensive multi-key guess (`code`/`errorCode`/`message` all equal to `"PASSWORD_CHANGE_REQUIRED"`) against the guard's 403 because the actual shape was never confirmed to them. Both gaps are on this backend, and both are needed together before the frontend gate can activate.

Investigating this surfaced a related, pre-existing gap in the same code path: `LocalStrategy.validate()` (used by `POST /auth/login`, the current primary login path per `CLAUDE.md`) returns only `{ userId, phone }`, while `AuthService.login()` unconditionally reads `user.roles`, `user.branches`, `user.managedBranches`, and `user.employeeId` off that same object to build the access token. Those fields are therefore already `undefined` — silently dropped, not merely absent — on every token issued by `POST /auth/login` today, not just `mustChangePassword`. This has to be touched to add the new claim, and leaving the sibling fields broken while fixing only the one field asked for would leave the frontend's decoded token still wrong for every password-login user.

## What Changes

- Add `mustChangePassword: boolean` to `AccessTokenPayloadDto` and populate it on every access token, sourced from the caller's live `User.mustChangePassword` at the moment of issuance (not cached/stale):
  - `POST /auth/login`: requires fixing `LocalStrategy.validate()` to build a fully-populated `AuthenticatedUserDto` (roles, branches, managedBranches, employeeId, mustChangePassword) the same way `JwtAccessStrategy.validate()` already does, instead of the current `{ userId, phone }`-only object. This also fixes the pre-existing missing-roles/branches/empId gap described above as a direct consequence — same fetch, same fix, not a separate effort.
  - `POST /auth/refresh` (`AuthService.refreshToken()`): already re-fetches the `User` fresh from the database on every call; just add `mustChangePassword` to the access token payload it builds.
  - `POST /auth/login/zalo` and `POST /auth/dev/login` already build their access token payload from a fresh `User` fetch (`createTokenPairForUser` / `issueAuthSessionForEmployee`) — add the same field there so all four issuance paths are consistent.
- Confirm (no code change — already true) and document the discriminated 403 shape for the frontend: `ForcePasswordChangeGuard` already throws `ForbiddenException({ message, details: { code: 'PASSWORD_CHANGE_REQUIRED' } })`, and `GlobalExceptionFilter` forwards `details` verbatim, so the response body is `{ statusCode: 403, message, source, details: { code: "PASSWORD_CHANGE_REQUIRED" }, timestamp }`. Frontend should narrow `isPasswordChangeRequired()` to `details.code === 'PASSWORD_CHANGE_REQUIRED'`.
- Confirm (no code change — already true) that `POST /auth/change-password` carries `@AllowWhilePasswordChangeRequired()` and is reachable by a flagged user; add a regression test pinning this so it can't silently regress now that the frontend is depending on it as the gate's only way out.
- Add an e2e test that decodes a flagged user's `POST /auth/login` access token and asserts `mustChangePassword: true`, and a corresponding e2e assertion on the 403 body shape from the guard — turning both confirmations into a locked contract rather than a one-time verbal answer.

## Capabilities

### Modified Capabilities
- `authentication`: the access token payload gains a `mustChangePassword` claim on all four issuance paths, and `POST /auth/login` specifically starts populating `roles`/`branches`/`managedBranches`/`empId` correctly (previously silently omitted).
- `forced-password-change`: the guard's 403 response shape (`details.code === 'PASSWORD_CHANGE_REQUIRED'`) and the `POST /auth/change-password` exemption become pinned, tested requirements instead of implementation detail a caller had to infer from source.

## Impact

- `src/modules/auth/dto/access-token-payload.dto.ts` (new field).
- `src/modules/auth/strategies/local.strategy.ts` (build a fully-populated `AuthenticatedUserDto`, mirroring `JwtAccessStrategy.validate()`).
- `src/modules/auth/auth.service.ts` (`login()`, `refreshToken()`, `createTokenPairForUser()`, `issueAuthSessionForEmployee()` — thread `mustChangePassword` into each access-token payload construction).
- No schema change — `User.mustChangePassword` already exists.
- No change to `ForcePasswordChangeGuard` or the `change-password` route decorator — both already correct; this change adds test coverage that locks the existing behavior down.
- Downstream: unblocks `berd.em-frontend`'s `close-forced-password-change-gate-window` tasks 8.3/8.9 and the narrowing of `src/lib/api/errors.ts`'s `isPasswordChangeRequired()` — the frontend should re-run their check once this ships.
