## Why

The frontend RBAC admin UI (built against `2026-08-25-permission-admin-api-support`)
has confirmed Role CRUD, the permission matrix, the ability simulator, and the
audit log all work end-to-end. Two items from its scope were deliberately
deferred out of that change and are now blocking further frontend work: a
user can only ever hold one `Role` (no multi-role assignment), and there is
no `ManagerBranch` data model or `$managedBranches` condition token for
branch-scoped grants (e.g. "a regional manager approves leave requests only
for branches they manage"), nor a catalog endpoint documenting which
condition field-names/tokens a permission's `condition` may use — the
frontend currently has no way to build a condition editor without
hardcoding field names.

## What Changes

- **BREAKING**: Replace `User.roleId` (scalar FK) with a `User` ↔ `Role`
  many-to-many relation via a new `UserRole` join table. A `User` SHALL hold
  one or more roles instead of exactly one.
- **BREAKING**: `AuthenticatedUserDto.role` (`string`) and
  `AccessTokenPayloadDto.role` (`string`) become `roles: string[]`.
  `CaslAbilityFactory` aggregates granted `(action, subject, condition)`
  permissions across every one of the caller's roles when building an
  `Ability`, instead of a single role's grants.
- Add `POST /users/:id/roles` / `DELETE /users/:id/roles/:roleId` (or
  equivalent) endpoints to assign/unassign a user's roles, replacing the
  `PUT /users/:id` `roleId` field.
- Add a `ManagerBranch` model (`userId`/`managerId`, `branchId`) and CRUD
  endpoints to assign a manager's managed branches.
- Add a `$managedBranches` condition token, resolved by
  `resolveCondition()` against the caller's `ManagerBranch` rows (analogous
  to `$self`), usable in a `RolePermission.condition` for `branchId`-bearing
  subjects (e.g. `{ "branchId": { "in": "$managedBranches" } }`).
  `AuthenticatedUserDto`/`AccessTokenPayloadDto` gain a `managedBranches:
  number[]` field distinct from the existing `branches` (an employee's own
  work branches).
- Add `GET /permissions/catalog`: lists each permission subject alongside
  the condition tokens and field-name conventions it supports (`$self`
  field-name suffix rules from `permission-condition.helper.ts`, plus the
  new `$managedBranches` token), so the frontend condition editor doesn't
  hardcode this.
- Extend the audited-subjects list (`AuditLogsService`) to include
  `user-roles` and `manager-branches`.

## Capabilities

### New Capabilities
- `multi-role-assignment`: `User` ↔ `Role` many-to-many via `UserRole`,
  role assignment/unassignment endpoints, and multi-role permission
  aggregation in `CaslAbilityFactory`.
- `managed-branch-scoping`: `ManagerBranch` model, managed-branch
  assignment endpoints, and the `$managedBranches` condition token.
- `permission-catalog`: `GET /permissions/catalog` documenting supported
  condition tokens/field-names per subject.

### Modified Capabilities
- `authorization`: permission data model changes from "each `User` assigned
  exactly one `Role`" to "one or more `Role`s"; CASL ability construction
  aggregates grants across all of the caller's roles; `$self` resolution
  gains a sibling `$managedBranches` token.
- `permission-introspection`: `GET /me/abilities` and
  `GET /users/:id/abilities` build the target's `Ability` from all of that
  user's roles, not a single role.
- `audit-log`: audited-subjects list gains `user-roles` and
  `manager-branches`.

## Impact

- `prisma/schema.prisma` (+ migration): drop `User.roleId`, add `UserRole`
  join table; add `ManagerBranch` model.
- `prisma/seed.ts`: seed role assignment via `UserRole` instead of
  `User.roleId`.
- `src/modules/auth/strategies/jwt-access.strategy.ts`,
  `src/modules/auth/dto/authenticated-user.dto.ts`,
  `src/modules/auth/dto/access-token-payload.dto.ts`,
  `src/modules/auth/auth.service.ts`: load and encode multiple roles and
  managed branches instead of one role.
- `src/modules/casl/casl-ability.factory.ts`,
  `src/common/guards/permission-condition.helper.ts`: aggregate permissions
  across roles; resolve `$managedBranches`.
- `src/modules/users/`: role assignment endpoints, `UserMapper`/response DTO
  changes (`role` → `roles`).
- `src/modules/abilities/abilities.service.ts`: load all of the target
  user's roles' grants.
- New `src/modules/manager-branches/` module (or folded into `users`):
  CRUD for `ManagerBranch`.
- `src/modules/permissions/`: new `GET /permissions/catalog` route.
- `src/modules/audit-logs/audit-logs.service.ts`: extend audited-subjects
  list.
- `prisma/seed.ts`: seed `Permission` rows for `user-roles` and
  `manager-branches` subjects.
- `openspec/specs/authorization/spec.md`,
  `openspec/specs/permission-introspection/spec.md`,
  `openspec/specs/audit-log/spec.md`: delta specs for the above.
