## Context

See `proposal.md` - Why for motivation. Current state relevant to this design:

- `POST /api/auth/login` (`LocalAuthGuard` → `LocalStrategy`) already works end-to-end for a
  `User` that has a `password` set, using `src/common/services/password.service.ts`
  (bcrypt, 12 salt rounds) for both hashing and comparison. It is **already rate-limited**
  (`@Throttle({ default: { limit: 5, ttl: 60000 } })` in `auth.controller.ts`) — the
  `harden-api-security-perimeter` proposal's claim that `/auth/login` has no rate limiting is
  stale relative to current code. The only real gap on the login path itself is that there is
  no product flow for a User to *get* a password in the first place.
- There are two password-hashing services with identical bcrypt logic:
  `src/common/services/password.service.ts` (used by `AuthService` and `LocalStrategy`) and
  `src/modules/auth/password.service.ts` (registered nowhere, imported nowhere — confirmed via
  repo-wide grep). The duplication is dead code, not an active fork.
- `PasswordResetToken` (`id`, `userId`, `hashToken`, `expiresAt`, `createdAt`) already has the
  fields this change needs — no migration required. There is no `used`/`consumed` marker; this
  design uses row deletion for invalidation, consistent with the codebase's no-soft-deletes
  convention.
- The refresh-token flow (`JwtRefreshStrategy.findValidToken`) already solves "match a bcrypt
  hash without an indexable equality lookup" by fetching a scoped candidate set and
  `bcrypt.compare`-ing in a loop. The original (deprecated) `forgotPassword`/`resetPassword`
  code did **not** do this — it used an unscoped `findFirst({ where: { expiresAt: { gt: ... } } })`,
  which returns an arbitrary unexpired token, not the one the caller actually submitted. This
  design reuses the refresh-token pattern instead.
- The `User` model has no email field and the codebase has no email/SMS delivery service, so
  there is no channel to deliver a self-service reset token automatically. Per product decision,
  this change ships an **admin-assisted** recovery path: an Admin generates a token on a User's
  behalf and relays it out of band; the public self-service `forgot-password` endpoint still
  exists (per the proposal) but its generated token is not delivered anywhere by this change.

## Goals / Non-Goals

**Goals:**
- Make password login fully usable end-to-end: an Admin can give a User a password, and a User
  who forgets it can recover access without a database edit.
- Fix the token-scoping bug from the original implementation while restoring it.
- Decouple Zalo linking from Zalo login.
- Leave exactly one password-hashing service in the codebase.

**Non-Goals:**
- Building an email/SMS/Zalo-ZNS delivery channel for the self-service `forgot-password` token
  (explicitly deferred — admin-assisted relay is the recovery path for this change).
- Adding an `email` field to `User` or any other schema change beyond what's listed below.
- Changing rate-limit values/config shared with `harden-api-security-perimeter` — this change
  adds `@Throttle` to the two new routes using the same pattern already on `/auth/login`, and
  does not touch that proposal's broader `helmet`/global config work.
- Building a UI for any of this (frontend work, out of scope for this backend repo).

## Decisions

**Consolidate on `src/common/services/password.service.ts`.** It's already the one actually
wired up (`AuthService`, `LocalStrategy`, `auth.module.ts` providers). Delete
`src/modules/auth/password.service.ts` outright — it's unreferenced dead code, not a second
call site to migrate.

**Reuse the refresh-token "scoped candidates + bcrypt.compare loop" pattern for reset-token
lookup**, rather than reintroducing `findFirst` on `expiresAt` alone. Since `ResetPasswordDto`
only carries `token` + `newPassword` (no username to pre-scope by), the candidate set is
`prisma.passwordResetToken.findMany({ where: { expiresAt: { gt: new Date() } } })`, then
`bcrypt.compare(submittedToken, row.hashToken)` per candidate until a match is found. This is
the same shape as `JwtRefreshStrategy.findValidToken`, just scoped by expiry instead of by user
(no JWT payload to scope by here — the token itself is the sole identifier). Reset-token volume
is expected to stay low (issued only via admin action or self-service request, short-lived), so
the linear scan is not a performance concern.

**Invalidate by deleting the row**, not by adding a `used`/`consumed` column — matches this
codebase's no-soft-deletes convention (see `CLAUDE.md`) and the `RefreshToken` precedent
(`cleanupExpiredTokens` hard-deletes). On successful reset, delete the matched
`PasswordResetToken` row in the same transaction as the password update.

**Invalidate prior outstanding tokens for a User when issuing a new one** (self-service or
admin-generated): delete any existing unexpired `PasswordResetToken` rows for that `userId`
before creating the new one. Not required by the spec (which allows multiple outstanding
tokens to exist and just requires correct scoping), but keeps the per-user candidate count at
0-or-1 and avoids stale tokens accumulating. This is an implementation choice, safely
reversible without a spec change if it turns out to be too aggressive.

**Admin-assisted token issuance is a separate, authenticated endpoint**, not a variant response
on the public `POST /api/auth/forgot-password`. Proposed shape: `POST
/api/users/:id/password-reset-token`, gated by `@RequirePermissions({ action: 'update',
subject: 'users' })` (reuses the existing User-management permission rather than minting a new
subject), returns `{ token, expiresAt }` in the response body since the caller is already an
authorized, non-anonymous Admin — unlike the public route, revealing the token here does not
leak account existence to an anonymous caller. It shares the same generation/hashing/expiry
logic as the self-service path (single internal helper, two callers).

**Authenticated Zalo-linking as `POST /api/auth/link/zalo`**, reusing `ZaloAuthService.
verifyAccessToken` (already used by `loginWithZalo`) but writing a `ZaloIdentity` row scoped to
`request.user.userId` instead of resolving a user by phone number. Guarded by the normal
`JwtAccessGuard` + `@RequirePermissions` (self-service, likely a `SkipPermissions`-style
self-only action similar to `active-sessions` — an authenticated User linking their own
account, not an admin action). Rejects if the caller already has a `ZaloIdentity`
(`@unique` on `User.zaloIdentity` via `ZaloIdentity.userId`) or if the target `zaloUserId` is
already linked to a different `User` (`@unique` on `ZaloIdentity.zaloUserId`) — both already
enforced at the DB level by existing unique constraints; the service layer catches `P2002` and
raises a clear `BadRequestException`, per this codebase's existing Prisma-error-handling
convention (no soft deletes, no pre-check-then-write races).

**`password` field on Users DTOs is write-only and optional both ways.** `CreateUserDto` and
`UpdateUserDto` gain `@IsOptional() @IsString() @MinLength(...) password?: string`. Hashing
happens in `UserService.create`/`update` (mirrors the existing hourly-rate-sync
`$transaction` pattern already used there) immediately before the Prisma write; the response
mapper (`UserMapper`) is not changed to include it, since it was never selected for responses
in the first place.

## Risks / Trade-offs

- **Self-service `forgot-password` is currently a dead end** (token generated, never
  delivered) → Mitigation: ship the admin-assisted path as the actual working recovery
  mechanism now; the self-service endpoint stays spec-compliant and forward-compatible for
  when a delivery channel is added later, and its generic non-revealing response is unaffected
  by that gap.
- **Deleting outstanding tokens on re-issuance could surprise a User who requested twice in
  quick succession** (e.g. double-click) → Mitigation: low risk given short expiry windows and
  rate limiting; acceptable trade-off for a simpler invalidation model.
- **Linear bcrypt.compare scan on reset-token lookup** could degrade if unexpired tokens ever
  accumulate at scale → Mitigation: capped by short expiry + rate limiting + the
  invalidate-on-reissue decision above, so steady-state candidate count stays small.
- **Admin token-issuance endpoint returns a live credential-equivalent value in a JSON
  response** → Mitigation: gated behind the same permission system as all other admin User
  management, and the value is short-lived/single-use like the self-service token; no new
  exposure surface beyond what an Admin resetting a password by phone already implies.

## Migration Plan

No schema migration needed (`PasswordResetToken` already has the required fields). Deploy as a
normal code change:
1. Delete `src/modules/auth/password.service.ts`; confirm `auth.module.ts` only registers the
   common one (already true) and `pnpm test` / `pnpm build` are clean.
2. Add `password` to Users DTOs + hashing in `UserService`.
3. Restore `forgotPassword`/`resetPassword` on `AuthService` with the corrected token lookup;
   restore the two controller routes with `@Throttle`.
4. Add the admin token-issuance route and the authenticated Zalo-linking route.
5. Update `CLAUDE.md`/`AGENTS.md`/`openspec/project.md` Auth sections last, per repo
   convention, once the above is implemented and tested.

No rollback complexity beyond a normal revert — no data migration, no destructive schema
change.
