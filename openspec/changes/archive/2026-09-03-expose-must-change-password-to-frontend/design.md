## Context

Four code paths mint an access token today, each building its own `AccessTokenPayloadDto` inline in `src/modules/auth/auth.service.ts`:

1. `login()` (password login, `POST /auth/login`) — builds the payload directly from the `AuthenticatedUserDto` returned by `LocalStrategy.validate()`.
2. `createTokenPairForUser()` (Zalo login, `POST /auth/login/zalo`) — re-fetches the `User` fresh (`authUserInclude`) and builds the payload from it.
3. `issueAuthSessionForEmployee()` (dev login, `POST /auth/dev/login`) — re-fetches the `Employee`+`User` fresh and builds the payload from it.
4. `refreshToken()` (`POST /auth/refresh`) — re-fetches the `User` fresh and builds the payload from it.

`LocalStrategy.validate()` (`src/modules/auth/strategies/local.strategy.ts`) currently returns `new AuthenticatedUserDto({ userId, phone })` — nothing else. `login()` then reads `user.roles`, `user.branches`, `user.managedBranches`, `user.employeeId` off that same object to build the token payload. Those four fields are therefore `undefined` on every `POST /auth/login` token today (JWT signing drops `undefined` keys, so they're simply absent from the decoded token) — a pre-existing bug, not something this change introduces, but one that has to be addressed to correctly add `mustChangePassword` to the same payload, since the fetch this needs is the same fetch that would fix it.

`JwtAccessStrategy.validate()` (used on every *subsequent* authenticated request, not at login) already shows the canonical way to build a fully-populated `AuthenticatedUserDto` from a fresh `User` row: fetch with `userWithRolePermissionsInclude`, map `roles`/`branches`/`managedBranches`/`permissions`/`employeeId`/`mustChangePassword` off it.

`ForcePasswordChangeGuard` (`src/modules/auth/guards/force-password-change.guard.ts`) already throws `ForbiddenException({ message, details: { code: 'PASSWORD_CHANGE_REQUIRED' } })`, and `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`) already forwards `details` verbatim into the final `{ statusCode, message, source, details, timestamp }` response body. `POST /auth/change-password` already carries `@AllowWhilePasswordChangeRequired()`. Nothing here needs to change — it needs to be confirmed and pinned with a test, since a frontend team is now building against it as a contract.

## Goals / Non-Goals

**Goals:**
- Every access token — from all four issuance paths — carries a `mustChangePassword: boolean` claim sourced from the live `User.mustChangePassword` at issuance time.
- `POST /auth/login`'s token stops silently dropping `roles`/`branches`/`managedBranches`/`empId`, fixed as a natural consequence of the same work (not a separately-scoped bug hunt).
- Lock the guard's discriminated-403 shape and the `change-password` exemption down with tests, so the frontend's now-explicit dependency on both can't regress silently.

**Non-Goals:**
- Changing `RefreshTokenPayloadDto` or the refresh token's own contents — it's never decoded client-side (only the access token is, per the frontend's own description), so it doesn't need this claim. `ForcePasswordChangeGuard` reads the flag from `request.user`, populated fresh per-request by `JwtAccessStrategy` from the database — never from refresh-token contents.
- Changing the guard's behavior, the exempted-route allowlist, or the 403 error shape/wording — all already correct; this is a confirm-and-test pass, not a redesign.
- A `/auth/me` endpoint — out of scope; the frontend has explicitly chosen to decode the access token instead.
- Any frontend-side change — `berd.em-frontend` owns `close-forced-password-change-gate-window` and will re-run their own checks once this ships.

## Decisions

**1. Refactor `login()` to re-fetch the full `User` and delegate to `createTokenPairForUser()`, rather than enriching `LocalStrategy.validate()`'s return value.**
`login()` becomes: look up the `User` by `user.userId` (the one thing `LocalStrategy` does reliably verify) with the same `authUserInclude` the other three paths already use, then call the existing private `createTokenPairForUser(freshUser)` — the same helper Zalo login already uses to build a correct, fully-populated payload. This:
- Fixes the missing-claims bug and adds `mustChangePassword` in one place, for both password and Zalo login simultaneously (both come from the same fetch shape).
- Requires no change to `LocalStrategy`, `AuthenticatedUserDto`, or the controller — `login()`'s signature and the guard chain are untouched.
- Avoids a third near-duplicate "build payload from a User row" implementation (there would otherwise be one in `LocalStrategy`, one in `JwtAccessStrategy`, and one in `AuthService`) — reuses the one `AuthService` already has.
- *Alternative considered*: make `LocalStrategy.validate()` build a fully-populated `AuthenticatedUserDto` itself, mirroring `JwtAccessStrategy.validate()`. Rejected: it would duplicate the same DB-row-to-profile mapping logic in a second strategy class, and `login()` would still need its own separate payload-building code (it doesn't call `createTokenPairForUser` today), so it fixes less for more new code than the re-fetch-and-delegate approach.

**2. Add `mustChangePassword` to `AccessTokenPayloadDto` only, not `RefreshTokenPayloadDto`.**
The claim's only consumer is the frontend decoding the *access* token. Adding it to the refresh token payload too would be harmless but pointless — see Non-Goals.

**3. Thread `mustChangePassword` into the three remaining payload-construction sites individually**, since `createTokenPairForUser` (now also covering password login per Decision 1) doesn't cover dev login or refresh:
- `createTokenPairForUser()`: add `mustChangePassword: user.mustChangePassword` (covers both password and Zalo login after Decision 1).
- `issueAuthSessionForEmployee()`: add `mustChangePassword: employee.user.mustChangePassword`.
- `refreshToken()`: add `mustChangePassword: user.mustChangePassword` (the fresh fetch it already does).

**4. No code change for the 403 shape or the change-password exemption — add tests instead.**
Both are already correct (see Context). The proposal's ask was to "pick one field/value and tell us exactly what it is" — that's a documentation/confirmation deliverable, not an implementation one. Locking it with an e2e assertion on the literal response body (`details.code === 'PASSWORD_CHANGE_REQUIRED'`) serves the same purpose as a spec requirement: it's now a tested contract, not something a future refactor could silently break without a test failing.

## Risks / Trade-offs

- **[Risk]** Re-fetching the `User` inside `login()` adds one extra DB round-trip compared to today's (broken) direct-payload-from-strategy path → **Mitigation**: negligible — `refreshToken()`, `createTokenPairForUser()` (Zalo), and `issueAuthSessionForEmployee()` (dev) all already do exactly this fresh fetch per login; password login was the outlier skipping it, not the norm.
- **[Risk]** A caller relying on today's `POST /auth/login` token already being missing `roles`/`branches`/`managedBranches`/`empId` (e.g. code that treats their absence as meaningful) would see new behavior → **Mitigation**: checked — `PermissionsGuard`/`JwtAccessStrategy` never read prior-token claims for authorization (every subsequent request re-derives everything from the database via `sub` alone, per `CLAUDE.md`), so nothing server-side depends on those fields being absent; this is a pure bugfix from the backend's perspective.
- **[Trade-off]** `mustChangePassword` omitted entirely on tokens issued before this change's rollout is deliberately treated as "not flagged" by the frontend per their own note — no backend-side migration or forced re-login is needed; existing sessions simply behave as before until they refresh.

## Migration Plan

No data migration — `User.mustChangePassword` already exists and is already populated correctly; this only changes what gets copied into the JWT payload at issuance. Deploy is a single release: token shape changes take effect the next time each client logs in or refreshes, with no compatibility shim needed since an old client already tolerates a token without new claims and a new client already tolerates one without them (per the frontend's stated fallback).

## Open Questions

None — the frontend's two asks (claim + discriminated 403) are both fully resolved by this design; the `roles`/`branches`/`empId` fix is a direct, unavoidable side effect of doing them correctly rather than a new open question.
