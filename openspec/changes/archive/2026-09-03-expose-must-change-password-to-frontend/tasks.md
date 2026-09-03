## 1. Access token payload

- [x] 1.1 Add `mustChangePassword: boolean` to `AccessTokenPayloadDto` in
      `src/modules/auth/dto/access-token-payload.dto.ts`. Leave
      `RefreshTokenPayloadDto` untouched (see design.md Decision 2).

## 2. Fix login() and thread the claim through all four issuance paths

- [x] 2.1 In `src/modules/auth/auth.service.ts` `login()` (~line 174), replace the
      inline `AccessTokenPayloadDto`/refresh-payload construction that reads
      `user.roles`/`user.branches`/`user.managedBranches`/`user.employeeId` off the
      `AuthenticatedUserDto` from `LocalStrategy`. Instead, fetch the `User` fresh by
      `user.userId` with `authUserInclude` (same include already used by
      `createTokenPairForUser`/`refreshToken`), and delegate to the existing private
      `createTokenPairForUser(freshUser)` helper.
- [x] 2.2 In `createTokenPairForUser()` (~line 293), add
      `mustChangePassword: user.mustChangePassword` to the `AccessTokenPayloadDto` it
      builds — this now covers both password login (via 2.1) and Zalo login.
- [x] 2.3 In `issueAuthSessionForEmployee()` (~line 324, dev login), add
      `mustChangePassword: employee.user.mustChangePassword` to `accessPayload`.
- [x] 2.4 In `refreshToken()` (~line 234), add `mustChangePassword: user.mustChangePassword`
      to the `AccessTokenPayloadDto` built from the freshly re-fetched `User`.

## 3. Unit tests

- [x] 3.1 Update `auth.service.spec.ts`'s `login` test(s): assert that
      `jwtTokenService.generateAccessToken` is called with `roles`, `branches`,
      `managedBranches`, `empId`, and `mustChangePassword` populated from a mocked
      fresh `User` fetch — not left `undefined`. Mock `prismaService.user.findUnique`
      for the id lookup `login()` now performs.
- [x] 3.2 Update `auth.service.spec.ts`'s `refreshToken` test(s): assert
      `mustChangePassword` is present on the generated access token payload and
      reflects the mocked `User.mustChangePassword` value.
- [x] 3.3 Add/update a test for `loginWithZalo`/`createTokenPairForUser` asserting
      `mustChangePassword` is included.
- [x] 3.4 Add/update a test for `loginWithDev`/`issueAuthSessionForEmployee` asserting
      `mustChangePassword` is included.

## 4. e2e coverage — lock the frontend-facing contract

- [x] 4.1 New (or extend an existing) e2e spec: create/use a `User` with
      `mustChangePassword: true`, log in via `POST /auth/login`, decode the returned
      access token (base64-decode the JWT payload segment — no need to verify the
      signature for this assertion), and assert `mustChangePassword === true`. Extended
      `test/auto-provision-user-on-employee-create.e2e-spec.ts` (added a
      `decodeJwtPayload` helper) rather than adding a new file, since it already builds
      exactly this flagged-user fixture.
- [x] 4.2 Same spec: for an unflagged `User`, assert the decoded token's
      `mustChangePassword === false`. Added to the existing post-change-password login
      assertion.
- [x] 4.3 Same spec: log in as the flagged `User`, call `POST /auth/refresh`, decode
      the newly issued access token, and assert `mustChangePassword` is still present
      and correct (covers design.md's "refresh preserves the claim" requirement).
      **Discovered and fixed an unrelated pre-existing bug this uncovered**:
      `JwtRefreshStrategy`'s passport extractor read `refresh_token` (snake_case) while
      the actual `RefreshDto` contract and the strategy's own token-comparison code both
      use `refreshToken` (camelCase) — `POST /auth/refresh` 401'd for any client sending
      its documented body shape. Fixed the one-line extractor field name in
      `src/modules/auth/strategies/jwt-refresh.strategy.ts` to match the two
      already-agreeing references in the same file; confirmed via `jwt-refresh.strategy.spec.ts`
      (still green) and this e2e spec (previously failed 401, now passes).
- [x] 4.4 Assert the guard's 403 body shape precisely: trigger
      `ForcePasswordChangeGuard` (flagged user hitting a non-allowlisted route) and
      assert the response body's `details.code === 'PASSWORD_CHANGE_REQUIRED'`.
      Already covered by the existing `blocks a non-exempt authenticated route with
      PASSWORD_CHANGE_REQUIRED` test in the same e2e spec (from
      `harden-initial-employee-password-provisioning`) — no duplicate added.
- [x] 4.5 Assert a flagged user's `POST /auth/change-password` call succeeds (not
      blocked by the guard). Already covered by the existing `changes the password and
      clears the flag, unblocking other routes` test in the same e2e spec — no
      duplicate added.

## 5. Confirm to the frontend team

- [x] 5.1 Once 1–4 are merged and passing, report back to `berd.em-frontend`
      (referencing `openspec/changes/close-forced-password-change-gate-window`
      tasks 8.3/8.9) that: the access token now carries `mustChangePassword` on
      login and refresh, and the guard's 403 body's `details.code` field is the
      literal string `"PASSWORD_CHANGE_REQUIRED"` — so `src/lib/api/errors.ts`'s
      `isPasswordChangeRequired()` can narrow from its defensive multi-key match to
      checking `details.code` alone. Message drafted below for the user to relay;
      also flagged the incidentally-discovered and now-fixed `POST /auth/refresh`
      field-name bug, since a frontend refresh call sending the documented
      `refreshToken` body field would have been silently 401'd before this fix.
