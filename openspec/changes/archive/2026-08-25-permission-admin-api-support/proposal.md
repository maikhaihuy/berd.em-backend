## Why

A frontend RBAC admin UI is being built against this backend, scoped to:
managing roles and permissions, linking permissions to roles with a
per-grant scope condition, assigning roles to users, an ability simulator
("what can user X do, and why"), and an audit trail. Role CRUD, Permission
CRUD, and role↔permission linking already work today. Investigation of the
current API surface turned up the real gaps that block the rest: a broken
write path on `PATCH /roles/:id`, no way to set a role-permission grant's
`$self` condition outside `prisma/seed.ts`, no way for a role to be flagged
as system-protected, no endpoint for a user (self or admin-on-behalf-of) to
introspect effective abilities, and no audit log at all. Building the admin
UI requires closing these gaps.

Explicitly out of scope for this change (raised during frontend planning,
deliberately deferred, not partially addressed): multi-role-per-user
(`User`↔`Role` stays a single `roleId`, not many-to-many), branch-scoped
(`$managedBranches`) conditions and the `ManagerBranch` table, and a
permission/condition field-name catalog endpoint. None of these are needed
for the roles/permissions/assignment scope this change covers.

## What Changes

- **BREAKING**: Remove the `permissionIds` field from `UpdateRoleDto` /
  `PATCH /roles/:id`. It currently writes `permissions: { set: ... } }` into
  the Prisma update — `Role` has no `permissions` relation (only
  `rolePermissions`), so this throws a Prisma runtime error on any caller that
  supplies it today; removing it makes that failure a clean 400 instead of a
  500, and the `role-permissions` endpoints remain the sole supported way to
  manage a role's grants.
- Add an optional `condition` field to `AssignPermissionsDto` (per
  `permissionId`) and to `RolePermissionResponseDto`, and pass it through in
  `RolePermissionsService`'s upsert, so a role's grant of a permission can
  have its `$self` scope set/updated via `POST /role-permissions` instead of
  only via seed data.
- Document and regression-test that `POST /role-permissions` is additive per
  `permissionId` (it already is — `RolePermissionsService.assignPermissions`
  upserts only the ids in the request, never touching other existing grants)
  so the frontend matrix knows a "Save" only needs to send changed cells, not
  the role's full grant set.
- Add `isSystemRole` (boolean) to `Role` / `RoleResponseDto`, seeded `true`
  on `Admin`, `Manager`, `Employee`. `DELETE /roles/:id` SHALL reject
  deleting a system role server-side (not just a frontend-disabled button).
- Add a self-scoped ability-introspection endpoint (`GET /me/abilities`,
  any authenticated user, no special permission) and an admin-scoped
  equivalent for an arbitrary user (`GET /users/:id/abilities`, permission-
  gated) that load the target's role/permissions the same way
  `JwtAccessStrategy` does, build an `Ability` via `CaslAbilityFactory`, and
  serialize the resulting granted `(action, subject, condition)` rules.
- Add an audit log capability: an append-only `AuditLog` model capturing
  actor, action, subject, entity id, and a diff/snapshot, written
  automatically on mutations to audited entities, plus a paginated/filterable
  `GET /audit-logs` list endpoint.
- **MODIFIES** the `authorization` capability: an unresolvable or unknown
  condition token (e.g. `$self` for a caller with no `employeeId`, or a
  malformed/unrecognized token) SHALL be dropped from the built `Ability`
  (that one rule excluded, a warning logged) rather than throwing and denying
  the *entire* request. This tightens once `condition` becomes admin-settable
  via `POST /role-permissions` (this change's first bullet) instead of only
  ever coming from trusted seed data, and is also required for `GET
  /me/abilities` / `GET /users/:id/abilities` to report a partially-broken
  grant set without 500ing.

## Capabilities

### New Capabilities
- `role-permission-conditions`: role-permission grants support a `condition`
  field settable through the API (documented as additive), `PATCH
  /roles/:id` no longer accepts (or silently mishandles) `permissionIds`,
  and `Role` exposes `isSystemRole` with server-side delete protection.
- `permission-introspection`: self- and admin-scoped effective-abilities
  lookup (`GET /me/abilities`, `GET /users/:id/abilities`).
- `audit-log`: an append-only audit trail recorded on mutations, exposed via
  a paginated/filterable list endpoint.

### Modified Capabilities
- `authorization`: an unresolvable/unknown condition token is dropped from
  the built `Ability` (with a logged warning) instead of denying the whole
  request — see design.md for the full rationale and the requirement this
  supersedes.

## Impact

- `src/modules/roles/dto/update-role.dto.ts`, `src/modules/roles/role.service.ts`
  (remove the broken `permissionIds` handling; add `isSystemRole` handling
  including delete protection).
- `prisma/schema.prisma` (+ migration) for `Role.isSystemRole`; `prisma/seed.ts`
  sets it `true` on the three base roles.
- `src/modules/role-permissions/dto/*.ts`, `role-permissions.service.ts`,
  `role-permissions.controller.ts`, `role-permissions.types.ts` (add
  `condition` passthrough; add/confirm additive-assignment test coverage).
- `src/modules/casl/casl-ability.factory.ts` (the drop-rule/log-warning
  change lands here or in its resolution helper) plus a new controller
  surface (new module or an addition to `users`) for the two abilities
  endpoints.
- `prisma/schema.prisma` (+ a new migration) for the `AuditLog` model; a new
  `src/modules/audit-logs/` module; `src/app.module.ts` registration; a
  write-path hook triggered from mutating services (design.md decides the
  mechanism — e.g. Prisma middleware/extension vs. explicit service calls).
- `openspec/specs/authorization/spec.md` — the "Unresolvable `$self` token
  denies the request" requirement is superseded by the drop-rule/log-warning
  behavior; needs its own delta spec file in this change (not yet created —
  see tasks.md).
- `prisma/seed.ts` unaffected beyond `isSystemRole` — it remains a valid way
  to seed conditions, now joined by the API path.
