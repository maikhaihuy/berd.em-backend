## Why

`POST /api/auth/refresh` unconditionally fails for a `User` that has no linked `Employee`
record: `AuthService.refreshToken()` calls the private `getEmployeeWithBranches(user)` helper
(`src/modules/auth/auth.service.ts:449-452`) to compute the new access token's `branches` list,
and that helper throws `NotFoundException('Employee record not found for user')` whenever
`user.employee?.id` is unset — regardless of whether the refresh token itself is valid. This
directly contradicts `POST /api/auth/login` (`AuthService.login()`,
`src/modules/auth/auth.service.ts:174-198`), which already tolerates a missing employee link by
passing through whatever `branches`/`empId` the caller resolved (empty/undefined), and matches the
`authentication` spec's existing "Login rejected for..." scenarios, none of which require an
employee link. In practice: any `User` without an `Employee` record can log in successfully, but
their session can never be refreshed — their access token (typically short-lived, e.g. 2 minutes
in this environment) silently becomes permanently unrefreshable a couple of minutes after login,
forcing a full re-login. This was found while verifying `staffhub-frontend`'s
`fix-silent-token-refresh-on-navigation` change against a real employee-less test account
(`settings`/`ChangeMe!123`).

## What Changes

- `getEmployeeWithBranches` no longer throws when the `User` has no linked `Employee` record
  (`user.employee?.id` is unset); it returns a value callers can treat as "no branches" instead.
  It SHALL continue to throw when `user.employee?.id` **is** set but the referenced `Employee` row
  cannot be found (a genuine data-integrity error, not a legitimate employee-less user).
- `AuthService.refreshToken()` treats a missing employee link as "no branches" (`branches: []`)
  instead of failing the whole refresh call, mirroring `AuthService.login()`'s existing tolerance.
- `AuthService.createTokenPairForUser()` (used by Zalo and dev login, which call the same helper)
  gets the same tolerance for free, closing the same latent gap there.
- No change to the "employee id set but employee row missing" failure path, no change to token
  shapes, no change to `POST /api/auth/login` itself (already correct).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `authentication`: the "Refresh and logout are unaffected by login method" requirement is
  extended to also state refresh is unaffected by whether the session's `User` has a linked
  `Employee` record.

## Impact

- `src/modules/auth/auth.service.ts` — `getEmployeeWithBranches`, `refreshToken`,
  `createTokenPairForUser`.
- No API contract/shape change: `POST /api/auth/refresh` still returns the same `TokenDto`
  (`{ accessToken, refreshToken }`); only its success condition changes for this one edge case.
- No database/schema change, no other module affected.
- Consumed by `staffhub-frontend`: fixes the "get logged out ~2 minutes after login" symptom for
  any account without a linked employee record (e.g. an Admin/Owner `User` never assigned as
  `Employee` at a branch).
