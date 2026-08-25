## Context

See `proposal.md` for motivation. Today: `User.roleId` is a scalar FK (one
role per user); `AuthenticatedUserDto`/`AccessTokenPayloadDto` carry a single
`role: string` and a `branches: number[]` sourced from `EmployeeBranch`
(where the employee works, not what they manage); `CaslAbilityFactory`
builds an `Ability` from one role's `rolePermissions`; `resolveCondition()`
in `permission-condition.helper.ts` resolves only `"$self"`, keyed by the
enclosing property name, and throws when the caller lacks the needed
identifier. There is no `ManagerBranch` model (a `UserBranch` stub is
commented out in `prisma/schema.prisma`, different shape, unused) and no
endpoint documenting which condition tokens apply to which subject.

## Goals / Non-Goals

**Goals:**
- `User` ↔ `Role` many-to-many with existing single-role users migrated
  losslessly.
- `CaslAbilityFactory` aggregates grants across every role a caller holds.
- A `$managedBranches` condition token, resolved the same way `$self` is,
  backed by a new `ManagerBranch` model.
- A catalog endpoint the frontend can introspect instead of hardcoding
  field-name conventions.

**Non-Goals:**
- Role hierarchies or inheritance between roles (still flat — a user's
  effective permissions are the union of their roles' grants, no role
  "inherits from" another).
- Branch-scoped roles (a `UserRole` assignment is still global, not
  per-branch) — `$managedBranches` achieves the branch-scoping the frontend
  needs without making role assignment itself branch-scoped.
- Retrofitting `$managedBranches` onto every branch-having subject in one
  pass — this change wires it into the CASL/condition-resolution machinery
  and extends the row-scoped subject list to include `master-shifts` as the
  first real usage; wiring it into every other branch-having subject
  (`sub-shifts`, `tasks`, `branch-schedule-configs`, ...) can follow
  incrementally using the same mechanism, seeding new conditions rather than
  changing code.

## Decisions

### `UserRole` join table, `User.roleId` dropped in the same migration

Considered keeping `roleId` as a "primary role" alongside `UserRole` for a
softer migration. Rejected: it creates two sources of truth (which wins if
they disagree?) and every read site (`JwtAccessStrategy`, `AbilitiesService`,
seed, mappers) would need to reconcile them. Instead, one migration:

1. Add `UserRole (userId, roleId)` as a composite-PK join table.
2. Data migration: for every existing `User`, insert one `UserRole` row from
   its current `roleId`.
3. Drop `User.roleId` and its FK.

This is a single deploy, not a phased rollout — acceptable because `roleId`
has exactly one consumer pattern (role lookups), all of which move to
`UserRole` in the same change. `RegisterDto.roleIds` (already plural, in the
deprecated password-register path) foreshadowed this shape.

### JWT payload: `role: string` → `roles: string[]`, `managedBranches: number[]` added

`AccessTokenPayloadDto`/`AuthenticatedUserDto` change shape (**BREAKING**).
Existing access tokens issued before deploy carry the old shape; since
access tokens are short-lived (`JWT_ACCESS_EXPIRATION`) and
`JwtAccessStrategy` re-derives everything from the DB on every request
(re-reading `payload.sub` and reloading the user), the *payload* fields
other than `sub`/`typ` are effectively advisory/redundant for authorization
already — the strategy doesn't trust them for `role`/`permissions` today
either (see "Per-request permission loading" in the `authorization` spec).
Old tokens keep working for authentication (`sub` unchanged) until they
naturally expire; no forced logout needed. Refresh tokens rotate through
`RefreshTokenService` and pick up the new payload shape on next use.

### `CaslAbilityFactory.createForUser()` takes a `permissions` union, not a per-role loop

`CaslUser.permissions` is already a flat list decoupled from which role
contributed each entry (`{ action, subject, condition }[]`) — multi-role
support is entirely a change to *how that list is assembled* (union across
roles instead of one role's `rolePermissions`), not to
`CaslAbilityFactory` itself. No dedup pass is needed: CASL's own semantics
already treat multiple rules for the same `(action, subject)` as "satisfied
if any rule matches" (see the authorization spec's "An unconditioned grant
becomes an unconditioned CASL rule" + "Two roles each contribute their own
rules" scenarios) — an unconditioned rule from one role and a conditioned
rule from another simply coexist, and the caller effectively gets the union
of what either grants.

### `$managedBranches` resolves to a list, empty is valid

`resolveSelfToken`'s failure mode (throw when the identifier is missing) is
right for `$self`: a condition keyed on an identifier the caller doesn't
have at all is nonsensical, not "correctly scoped to nothing" — an
`Employee` route conditioned on `employeeId: "$self"` for a caller with no
`employeeId` should drop that rule, not silently render the caller
"employeeId: undefined". `$managedBranches` is different: "the branches I
manage" has an obviously valid empty answer (a newly-assigned manager with
no branches yet) — resolving to `{ in: [] }` and filtering out every row is
the *correct* behavior, not a broken condition. So the new resolver
(`resolveManagedBranchesToken`, alongside `resolveSelfToken` in
`permission-condition.helper.ts`) never throws for "empty"; it throws only
for a genuinely unrecognized field name (mirroring `$self`'s "unsupported
field" branch), keeping the drop-rule-and-log behavior for that case
consistent with the rest of `resolveCondition()`.

`SelfIdentity` (the interface `resolveCondition` takes) grows a
`managedBranches?: number[]` field alongside `employeeId`/`userId`; both
`JwtAccessStrategy` and `AbilitiesService` populate it from the target
user's `ManagerBranch` rows.

### `permissions/catalog` is computed, not stored

The catalog is derived at request time from `Permission.subject` values
already in the DB, matched against a hardcoded field-introspection table
(the same `EmployeeId`/`UserId` suffix rules `resolveSelfToken` already
encodes, plus a `branchId`-presence table for `$managedBranches`) rather
than a new schema table — the convention lives in code
(`permission-condition.helper.ts`) already, and the catalog endpoint's job
is to *reflect* that code, not to be a second source of truth that could
drift from it. Concretely: `permission-condition.helper.ts` exports the
suffix rules and a `subjectsWithBranchId` set; both `resolveCondition` and
the new `PermissionsService.getCatalog()` import from the same place.

### `ManagerBranch` as its own model, not extending `EmployeeBranch`

Considered adding an `isManaged` flag to `EmployeeBranch` instead of a new
table. Rejected per the "manager manages branches they don't personally
work at" scenario in the `managed-branch-scoping` spec — managing and
working-at are independent facts about a `User`/`Branch` pair, and
`EmployeeBranch` is keyed by `employeeId` (requires an `Employee` record),
while a user with no `Employee` row (e.g. an office-only admin) should still
be able to manage branches. `ManagerBranch` is keyed by `userId` directly.

## Risks / Trade-offs

- **[Risk] Breaking JWT/DTO shape change hits every client reading `role`**
  → Mitigation: frontend is the only consumer (per CLAUDE.md, this is an
  internal API), already coordinating through OpenSpec changes; the "Impact"
  section of `proposal.md` enumerates every touched file so the PR is a
  single atomic deploy, not a phased rollout the frontend has to straddle.
- **[Risk] Migration ordering: `UserRole` backfill must run before
  `roleId` is dropped, or data is lost** → Mitigation: single Prisma
  migration file with the backfill as a raw-SQL step between the `CREATE
  TABLE UserRole` and `ALTER TABLE users DROP COLUMN "roleId"` statements
  (Prisma migrations run as one transaction), not two separate `db:dev`
  runs.
- **[Risk] A user ending up with zero roles (e.g. removing their last role
  mid-request-cycle) would build an empty `Ability` and 403 everything,
  including their own admin session** → Mitigation: "last role" removal is
  rejected server-side (see `multi-role-assignment` spec), not just
  frontend-disabled.
- **[Trade-off] `master-shifts` gains row-scoping filtering as part of this
  change (needed to make `$managedBranches` demonstrable/testable) while
  other branch-having subjects don't yet** → Accepted as a Non-Goal; the
  mechanism generalizes, follow-up changes extend the subject list via seed
  data, not new code.
- **[Testing pitfall] A `$managedBranches`-conditioned grant looks
  unconditioned ("full access") if the test user holds it alongside a role
  that also grants the same `(action, subject)` unconditionally** → This is
  correct CASL union semantics (see "Two roles each contribute their own
  rules" in the `authorization` spec: `accessibleBy` ORs every matching
  rule's conditions together, and an unconditioned rule matches everything,
  so it always wins the OR) — not a resolution bug. It's an easy trap when
  manually verifying the feature: `Admin` holds `manage`/`all` (a wildcard
  matching everything) and `Manager` holds unconditioned `read:master-shifts`
  by default, so a manually-created test user must hold *only* the
  `$managedBranches`-scoped role — no `Admin`/`Manager` — to observe the
  scoping take effect. `GET /users/:id/abilities` on that isolated user is
  the fastest way to confirm resolution in isolation. Confirmed working
  end-to-end (empty-list and populated-list resolution, plus the
  masking-by-a-broader-role behavior above) via direct verification against
  a running instance on 2026-08-25.
- **[Testing pitfall] Never test condition changes directly on a seeded
  system role (`Admin`/`Manager`/`Employee`)** → Always create a disposable
  test role instead. Deleting a `RolePermission` grant to "revert" a manual
  edit does not restore its original condition — it removes the grant
  entirely, which for a system role's default (unconditioned) grant is a
  regression, not a revert. If a system role's grants are ever suspected to
  be out of sync with `prisma/seed.ts`, re-running `pnpm db:seed` restores
  them (it's idempotent by design — see the `authorization` spec's
  "Permission data model and role seeding" requirement).

## Migration Plan

1. Prisma migration: add `UserRole`, add `ManagerBranch`, backfill
   `UserRole` from `User.roleId`, drop `User.roleId` — one migration file,
   one `pnpm db:dev`.
2. Seed: add `Permission` rows for `user-roles`/`manager-branches` subjects,
   grant them to `Admin` only; update `prisma/seed.ts`'s role assignment to
   go through `UserRole`.
3. Land the JWT/DTO/`CaslAbilityFactory`/`resolveCondition` changes and the
   new endpoints together (they're mutually dependent — the strategy can't
   load `roles` plural until the schema/migration lands, and the ability
   factory's tests need the new `CaslUser.permissions` shape).
4. No feature flag / dual-write phase — see "Risks" above for why a single
   atomic deploy is acceptable here.

## Open Questions

None — the deferred-scope items from `2026-08-25-permission-admin-api-support`
named exactly these three gaps, so scope is fixed; remaining choices are
resolved above.
