## Context

See `proposal.md` - Why for motivation. Current state, confirmed on `develop`:
- `EmployeesService.create` (`src/modules/employees/employee.service.ts`) does a single
  non-transactional `prisma.employee.create(...)` after a pre-check against
  `Employee.phoneNumber` (a separate, unrelated uniqueness check from the one this change
  adds against `User.phoneNumber`).
- `UsersService.create` (`src/modules/users/user.service.ts`) shows the existing pattern for
  hashing an optional password (`PasswordService.hash`) and assigning roles via a nested
  `userRoles: { create: [...] }` write; there's no `$transaction` there either since a User's
  role assignment is a single nested write, not two independent top-level entities.
- `Role` rows are resolved by `name` elsewhere already (`prisma/seed.ts` does
  `prisma.role.findUnique({ where: { name: 'Employee' } })`), so looking up the `Employee`
  role by name at write time - not caching an id anywhere - is already this codebase's
  convention.
- Global guard order today (`src/common/authz.module.ts`): `ThrottlerGuard` →
  `JwtAccessGuard` → `PermissionsGuard`.
- Of the routes `auth.controller.ts` exposes, `login`, `refresh`, `logout`, `logout-device`
  are all `@Public()` - they authenticate via the refresh-token cookie/body, not
  `JwtAccessGuard`, so `req.user` is never populated on them and a guard keyed off
  `req.user.mustChangePassword` cannot act on them at all. Only `logout-all` and
  `active-sessions` are authenticated (`@SkipPermissions()`) without being `@Public()`.

## Goals / Non-Goals

**Goals:**
- Make Employee + User creation atomic and consistent with the existing fail-loud style
  (`P2002`/`P2025` translated to `BadRequestException`/`NotFoundException`).
- Keep the forced-password-change mechanism a thin, request-scoped check with no new
  caching layer and no schema field beyond the one boolean already scoped in the proposal.

**Non-Goals:**
- Backfilling `userId` for pre-existing Employees (explicitly deferred in proposal.md).
- Any change to `UsersService.create`'s standalone password/role flow.
- Rate-limiting or throttling the new `/auth/change-password` route beyond what already
  exists on authenticated routes generally (no brute-force concern beyond the existing
  `currentPassword` check, which is a per-user bcrypt compare, not a public/anonymous route).

## Decisions

**1. Transaction shape and write order in `EmployeesService.create`**
Inside one `prisma.$transaction(async (tx) => { ... })`:
1. Check `tx.user.findUnique({ where: { phoneNumber } })` - if found, throw
   `FieldValidationException('phoneNumber', ...)` (aborts the transaction; nothing has been
   written yet).
2. Resolve the `Employee` role: `tx.role.findFirstOrThrow({ where: { name: 'Employee' } })`.
3. `tx.user.create(...)` with the hashed phone-derived password, `status: ACTIVE`,
   `mustChangePassword: true`, and `userRoles: { create: [{ roleId }] }`.
4. `tx.employee.create(...)` with `userId` set to the just-created User's id (User must be
   created first - `Employee.userId` is a plain FK column, not a nested-write target, so
   there is no way to create both in one nested Prisma call).
5. Return the Employee (mapped via the existing `EmployeeMapper`).

The existing `Employee.phoneNumber` pre-check (a different uniqueness dimension, on a
different model) stays exactly where it is today, outside the new logic.

*Alternative considered*: create the Employee first with `userId: null` then update it -
rejected because it briefly persists an Employee with no linked User even within the
transaction, and the proposal is explicit that both should be created together with no
intermediate unlinked state.

**2. Resolving the `Employee` role id at write time, not at module init**
The proposal suggested resolving it "at startup/module init." Design decision: resolve it
inline inside the transaction on every call instead. Rationale: this is an Admin-only,
low-frequency write path (not a hot loop), so the extra `findFirstOrThrow` is negligible
cost; a startup-cached id would go stale if the `Employee` role is ever renamed, and would
require its own invalidation story for no real benefit here. Matches the existing
`findUnique({ where: { name: ... } })` convention already used in `prisma/seed.ts`.

**3. Phone-collision check is not race-free by itself - rely on the unique constraint as backstop**
The `tx.user.findUnique` pre-check is a normal read inside a Postgres `READ COMMITTED`
transaction, so two concurrent requests for the same phone number could both pass the
check before either commits. The existing `catch` block already maps `P2002` to
`FieldValidationException` for the Employee-phone case; extend the same catch to cover
`User.phoneNumber`'s unique constraint too, so a race is still rejected loudly rather than
silently creating a duplicate or corrupting state - consistent with this codebase's
existing pattern of pre-check *and* catching `P2002`, never relying on only one.

**4. `ForcePasswordChangeGuard` placement and exemption mechanism**
Insert the new guard between `JwtAccessGuard` and `PermissionsGuard` in
`src/common/authz.module.ts`'s `APP_GUARD` list, so a flagged user is rejected before any
permission-resolution work happens. The guard:
- Returns `true` immediately if `@Public()` is set (mirrors `JwtAccessGuard`/
  `PermissionsGuard`'s existing pattern) or if `request.user` is absent (defensive - covers
  any current or future `@Public()` route the guard runs on where no user was attached).
- Otherwise checks a new `@AllowWhilePasswordChangeRequired()` decorator (same shape as
  `@SkipPermissions()`) and returns `true` if present.
- Otherwise, if `request.user.mustChangePassword === true`, throws a `ForbiddenException`
  with a distinct machine-readable code (`PASSWORD_CHANGE_REQUIRED`) the frontend can key
  off; else returns `true`. Implementation note: `GlobalExceptionFilter`
  (`src/common/filters/global-exception.filter.ts`) only forwards `message`, `source`,
  `details`, and `errors` from an `HttpException` body to the client — an arbitrary `code`
  key is silently dropped. The code is therefore carried in `details: { code: ... }`, the
  one pass-through field the filter actually forwards, not as a top-level `code` property.

Because `login`, `refresh`, `logout`, and `logout-device` are already `@Public()` today,
only `POST /auth/change-password` (the new route) and `POST /auth/logout-all` need the
`@AllowWhilePasswordChangeRequired()` decorator in practice - `active-sessions` deliberately
does *not* get it, so a flagged user cannot even inspect their sessions until they change
their password, matching the proposal's "small allowlist" intent.

**5. `POST /auth/change-password` validates `currentPassword` unconditionally**
Reuses `PasswordService.compare`/`hash` (same service `UsersService.create` and login use)
rather than the `PasswordResetToken` flow, per proposal.md - that flow is for logged-out
recovery, this is for a logged-in, identity-proven user. On success: hash `newPassword`,
persist it, set `mustChangePassword: false`, in a single `prisma.user.update(...)` (no
transaction needed - one row, one write).

## Risks / Trade-offs

- **Phone-derived initial password is guessable** → accepted product trade-off (already
  decided in proposal.md), mitigated by `mustChangePassword` blocking all other access
  until it's changed.
- **Concurrent Employee-create requests for the same phone number** → mitigated by
  catching `P2002` on `User.phoneNumber` as a backstop to the pre-check (Decision 3).
- **A guard keyed on `req.user` could silently no-op on a route that forgets to run after
  `JwtAccessGuard`** → not a new risk introduced here; guard order is fixed centrally in
  `authz.module.ts`, same as the existing `PermissionsGuard`/`JwtAccessGuard` pairing.
- **If the seeded `Employee` role is ever renamed or deleted**, `findFirstOrThrow` throws
  and Employee creation fails loudly (500-ish, uncaught by the existing `P2002`/`P2025`
  branches) rather than silently creating an Employee with a User that has no role - this
  is the intended fail-closed behavior, not a gap, but worth calling out since it's a new
  failure mode for this endpoint.

## Migration Plan

1. Prisma migration: add `mustChangePassword Boolean @default(false)` to `User`. Additive,
   default `false` - no behavior change for any existing User until this feature starts
   setting it `true`.
2. Ship the schema change, the `EmployeesService.create` transaction rewrite, the new
   `/auth/change-password` route, and `ForcePasswordChangeGuard` together in one deploy -
   the guard and endpoint are meaningless without something that sets the flag, and the
   flag is dangerous to set without the guard/endpoint already live.
3. Rollback: the migration is additive and harmless to leave in place even if the feature
   code is rolled back (no existing User ever has the flag set by any other path); no data
   migration/backfill is involved, so rollback is a plain code revert.
