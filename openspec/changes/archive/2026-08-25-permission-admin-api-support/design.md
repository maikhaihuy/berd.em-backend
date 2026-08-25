## Context

An admin RBAC UI (permission matrix, role/permission CRUD, role assignment,
an ability simulator, an audit trail view) is being built against this API,
scoped explicitly to roles/permissions/assignment — not multi-role-per-user
or branch-scoped permissions (see Non-Goals). Investigation of the current
backend surfaced the concrete gaps this change closes, detailed in the
proposal:

1. `PATCH /roles/:id` accepts `permissionIds` (`update-role.dto.ts`) and
   `role.service.ts:150-159` writes `permissions: { set: [...] } }` into the
   Prisma update — `Role` has no `permissions` relation, only
   `rolePermissions`, so this throws at runtime. The composite-key
   construction also reuses the `.map((id) => ...)` callback's `id` (a
   permission id) for both `roleId` and `permissionId`. `role-permissions.*`
   is the only working way to manage grants today.
2. `RolePermission.condition` can only be set by `prisma/seed.ts` —
   `AssignPermissionsDto` and `RolePermissionsService.assignPermissions`
   never read or write it.
3. Nothing distinguishes a system-protected role (`Admin`/`Manager`/
   `Employee`) from an admin-created one — `DELETE /roles/:id` will happily
   delete any of them.
4. `CaslAbilityFactory.createForUser()` is only ever invoked inside
   `PermissionsGuard` for the currently authenticated caller
   (`JwtAccessStrategy.validate`); nothing lets a caller ask "what can I do"
   (self) or an admin ask "what can user X do" (arbitrary target).
5. No audit trail exists beyond the per-row `createdBy`/`updatedBy` scalar
   columns already on every mutable model.
6. `resolveSelfToken` (`permission-condition.helper.ts`) throws
   `ForbiddenException` for any unresolvable or unrecognized condition
   token, denying the *entire* request even when the caller holds other,
   perfectly valid grants that alone would satisfy the route. That's an
   acceptable failure mode only while every `condition` comes from trusted
   seed data; once gap #2 makes `condition` admin-settable through the API,
   one bad grant souring an otherwise-valid request becomes a real
   footgun — and the two abilities-introspection endpoints (gap #4) need to
   *report* a partially-broken grant set, not 500 on it.

## Goals / Non-Goals

**Goals:**
- Make `role-permissions` conditions settable through the API, and document
  that assignment is additive (doesn't require sending a role's full grant
  set).
- Remove the broken, unused `PATCH /roles/:id` write path cleanly (400, not
  a 500 from an unhandled Prisma error).
- Let the frontend distinguish system-protected roles without hardcoding
  role names, enforced server-side.
- Let a caller inspect their own effective abilities, and let an admin
  inspect any user's.
- Record who changed what on audited entities, and expose it as a list.
- Make condition resolution fail closed *without* over-denying: drop the one
  bad rule, keep evaluating the rest.

**Non-Goals:**
- Multi-role-per-user. `User`↔`Role` stays a single required `roleId`; no
  join table, no JWT/`AuthenticatedUserDto` shape change. Raised during
  frontend planning and explicitly deferred — the roles/permissions/
  assignment scope this change covers doesn't need it.
- Branch-level (`$managedBranches`) or any other new condition-scope
  concept, and the `ManagerBranch` table it would need — out of scope per
  `CLAUDE.md` and the `authorization` spec; only `$self` conditions exist
  today and this change doesn't add new token types, only changes how an
  *unresolvable* one is handled (Decision 6).
- A permission/condition field-name catalog endpoint — deferred; not needed
  for this change's scope.
- A generic Prisma-level audit-everything interceptor covering every model
  in one shot — start with the mutable, permission-guarded entities already
  enumerated in `prisma/seed.ts`'s subject list; new subjects opt in the
  same way new modules already register permissions.
- Reworking `CaslAbilityFactory`'s rule-construction algorithm — the
  abilities endpoints reuse it unchanged; only the token-resolution helper
  it calls changes (Decision 6).

## Decisions

### 1. Fix `PATCH /roles/:id` by deleting the broken field, not repairing it
`UpdateRoleDto` drops `permissionIds` entirely; `RoleService.update` drops
the `permissions: { set: ... } }` block. Because `ValidationPipe` is
configured with `forbidNonWhitelisted: true` (`exception.module.ts`), any
caller still sending `permissionIds` gets a clean 400 from the pipe instead
of reaching the service and throwing a Prisma error. This is simpler and
safer than fixing the composite-key bug and wiring it to a real relation,
since `role-permissions` already owns this responsibility correctly
(transactional upsert, existence checks) — duplicating it on `roles` would
just recreate the "two ways to do the same thing" problem that caused the
bug. **BREAKING** for the (already-broken) field, not for any working
client.

### 2. `condition` on `AssignPermissionsDto` is per-permission-id, optional, unvalidated JSON
`AssignPermissionsDto.permissionIds: number[]` becomes
`grants: { permissionId: number; condition?: Record<string, unknown> }[]`
(or `permissionIds` kept for the no-condition case — final shape decided in
tasks). `condition` is passed straight to
`RolePermission.upsert({ update: { condition }, create: { ...,
condition } })`, matching how `Permission.condition` is already typed as
`Json?` with no schema validation beyond "valid JSON" (mirroring the
existing seed's approach — `resolveCondition`/`$self` resolution happens at
ability-build time, not at write time, so an admin can write a condition
whose keys don't yet resolve for any caller without the write itself
failing). Rejected alternative: validating the condition shape against the
per-subject field catalog at write time — deferred because it would
duplicate the catalog's field list in two places (write-time validator and
the catalog endpoint) for a data model that's still just "partial Prisma
`where` object," and the existing seed data isn't validated this way either.

### 3. `Role.isSystemRole` is enforced server-side, not just a frontend hint
`Role` gains `isSystemRole Boolean @default(false)`; `prisma/seed.ts` sets it
`true` on `Admin`, `Manager`, `Employee`. `RoleService.remove` checks the
flag before deleting and throws `BadRequestException` if set — the frontend
can still disable the delete button using the same field, but the
protection doesn't depend on the frontend doing so. Rejected alternative:
frontend-only protection (hardcode or fetch-and-check the three role names
client-side) — rejected per the requirement's own stated reason (avoid
hardcoding role names) and because a non-UI client (script, other frontend)
would have no protection at all.

### 4. One abilities-lookup code path serves both `/me` and an admin target
`GET /me/abilities` (any authenticated user, `@SkipPermissions()` — it's
inherently self-scoped, nothing to gate beyond authentication, same pattern
as `/auth/active-sessions`) and `GET /users/:id/abilities` (admin-gated)
both load a user with `userWithRolePermissionsInclude` (already exported
from `user.types.ts`), build the same `{ userId, employeeId, permissions }`
shape `JwtAccessStrategy.validate` builds, and call
`CaslAbilityFactory.createForUser()` on it — `/me` loads the caller
(`request.user.userId`, already available, no extra query needed beyond
what's already loaded for the request), the admin route loads
`:id`. Both serialize the built `Ability`'s rules (`ability.rules`) as
`{ action, subject, inverted, conditions }[]` rather than re-deriving them
from raw `RolePermission` rows, so each endpoint reports what its target
would *actually* get (post `$self`-resolution against that user's identity,
and post Decision 6's drop-rule filtering for anything unresolvable) — never
the literal `"$self"` token. The admin route is gated by a new
`read`/`user-abilities` permission (its own `(action, subject)` pair, not
folded into `read:users`) so it can be granted narrowly.

### 5. Audit log is written explicitly in service methods, not via Prisma middleware
Each audited service's existing mutation methods (already the sole write
path per module convention) make one additional
`this.auditLogService.record({ actorId, action, subject, entityId, before,
after })` call after a successful Prisma write, inside the same
`$transaction` where one is already used (e.g. employees' hourly-rate sync)
or as a best-effort follow-up write otherwise. Rejected alternative: a
Prisma Client `$extends`/middleware hook that intercepts every `create`
/`update`/`delete` globally — rejected because it can't cleanly capture
*actor* (the middleware has no request context) without threading
`AsyncLocalStorage` through the whole app, which is a much bigger change
than this proposal's scope; explicit calls also make it obvious, per
module, which subjects are and aren't audited (matching how permission
checks are already explicit per route rather than inferred).
`AuditLog` gets its own `Int` autoincrement id, `actorId Int`, `action
String`, `subject String`, `entityId Int`, `before Json?`, `after Json?`,
`createdAt DateTime @default(now())` — no `updatedBy`/`updatedAt` since rows
are append-only and never mutated, consistent with an audit log's own
nature even though it breaks from this codebase's usual
`createdAt/createdBy/updatedAt/updatedBy` convention on every other mutable
model (there is nothing to update).

### 6. Unresolvable/unknown condition tokens drop their one rule and log, never throw
`CaslAbilityFactory.createForUser()` (or the resolution helper it calls,
`permission-condition.helper.ts`) wraps each grant's `resolveCondition` call
individually: on failure (missing identifier for a known token, or a token
the resolver doesn't recognize at all), it logs a warning via
`LoggerService` (`{ roleId/grantId, subject, action, reason }`) and excludes
*that one rule* from the built `Ability`, then continues building the rest.
`PermissionsGuard.canActivate` no longer needs a try/catch around ability
construction — `createForUser()` never throws for a bad condition, it just
returns an `Ability` with fewer rules than grants. The route-level
`ability.can(action, subject)` check (and `accessibleBy` downstream) then
behaves exactly as if that one grant didn't exist: the caller is denied only
if *no* surviving rule satisfies the route, same as having one fewer grant.
This **modifies** the `authorization` spec's existing "Unresolvable `$self`
token denies the request" requirement, which currently 403s the whole
request instead. Rejected alternative: keep throwing, but only from the two
new abilities-introspection endpoints while the live guard path keeps
denying-the-whole-request — rejected because it means the exact same
condition, resolved through two different call paths, fails differently
depending on which endpoint hit it, which is worse to reason about than one
consistent rule.

## Risks / Trade-offs

- [Removing `permissionIds` from `UpdateRoleDto` breaks any existing caller
  that (perhaps unknowingly, since it always 500'd) sends it] → It already
  errors for every such caller today; turning that into a 400 is strictly a
  behavior improvement, not a new break for any client that currently
  succeeds.
- [Explicit per-service audit calls will be missed on some mutation path as
  new code is added, silently under-auditing] → Cover the initial rollout
  with an e2e test per audited module asserting a write produces exactly one
  `AuditLog` row; note in `AGENTS.md`/`CLAUDE.md` that new mutations on
  audited subjects need the same call, the same way `@RequirePermissions`
  is already a manual per-route convention enforced by code review, not a
  compiler check.
- [`condition` accepted as unvalidated JSON on `POST /role-permissions`] →
  Bounded blast radius, now smaller than before Decision 6: an admin-only
  route already gated by `update:role-permissions`, and a malformed
  condition only drops *that one grant* (logged) rather than denying every
  request that would otherwise have matched it — worse-case impact is "this
  specific grant silently doesn't apply," not "unrelated requests start
  403ing."
- [Decision 6's drop-rule behavior means a broken condition fails silently
  from the caller's point of view — no error surfaces to whoever is
  affected, only a server-side log line] → Mitigated by the abilities
  endpoints this same change adds: `GET /me/abilities` /
  `GET /users/:id/abilities` report the *resolved* rule set, so a dropped
  rule is visible there as "this grant isn't present" even without digging
  through server logs; an admin debugging "why can't user X do Y" via the
  simulator will see the gap.
- [New `AuditLog` table adds write latency to every audited mutation] →
  Each write is a single indexed insert on a dedicated table, not a
  cross-table transaction beyond the one already wrapping the mutation
  itself; acceptable for admin-facing write volume in this system.

## Migration Plan

1. Ship the `PATCH /roles/:id` fix, `role-permissions` `condition` support,
   and `Role.isSystemRole` together (small, additive, touches the same two
   modules).
2. Ship Decision 6 (drop-rule/log-warning condition resolution) — no schema
   change, touches `casl-ability.factory.ts`/`permission-condition.helper.ts`
   and removes the now-unneeded try/catch in `PermissionsGuard`. Ship before
   step 4 so the abilities endpoints can rely on it existing.
3. Add a Prisma migration for `AuditLog` (`pnpm db:dev --name
   add-audit-log`), the `audit-logs` module, and wire the explicit
   `record()` calls into the mutation methods of the modules already listed
   as row-scoped subjects in the `authorization` spec
   (`time-logs`, `leave-requests`, `assignments`, `payroll-entries`,
   `availability`, `attendance-history`) plus `roles`/`permissions`/
   `role-permissions`/`users` (the RBAC subjects themselves).
4. Add the `/me/abilities` and `/users/:id/abilities` endpoints last —
   they're pure reads with no data-model change, and depend on step 2.
5. No rollback data concerns: steps 1, 2, and 4 are additive/non-destructive;
   step 3's migration only adds a new table, so `db:deploy` rollback is a
   drop-table migration if ever needed.

## Open Questions

- Exact request/response shape for `AssignPermissionsDto`'s `condition`
  field (per-id array vs. keeping the flat `permissionIds` array for the
  common no-condition case and adding a separate endpoint/field for
  conditioned assignment) — left for `tasks.md` to pin down against
  existing frontend expectations.
- Whether `GET /audit-logs` needs cursor pagination to match other list
  endpoints' conventions in this codebase, or offset-based is acceptable
  given expected volume — resolve during implementation by checking the
  nearest existing paginated list endpoint's convention.
- The `authorization` capability's delta spec (for Decision 6) doesn't exist
  in this change yet — `specs/authorization/spec.md` needs to be created
  (via `/opsx:continue`) before this change is ready to implement.
