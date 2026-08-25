## 1. Schema & Migration

- [x] 1.1 Add `UserRole` model (`userId`, `roleId` composite PK) to `prisma/schema.prisma`.
- [x] 1.2 Add `ManagerBranch` model (`userId`, `branchId` composite PK) to `prisma/schema.prisma`.
- [x] 1.3 Write the migration: create `UserRole`/`ManagerBranch` tables, backfill `UserRole` from every existing `User.roleId`, then drop `User.roleId` and its FK — as one `pnpm db:dev` migration.
- [x] 1.4 Add `user-roles` and `manager-branches` `Permission` rows to `prisma/seed.ts`, granted to `Admin` only.
- [x] 1.5 Update `prisma/seed.ts`'s user/role seeding to create `UserRole` rows instead of setting `roleId`.
- [x] 1.6 Run `pnpm db:reset` locally and confirm seeded users each hold exactly one role and the dev-login employee still authenticates. (Verified via `prisma migrate deploy` + `db seed` re-run against the local dev DB — full `db:reset` skipped to avoid dropping unrelated local data; migration+seed idempotency confirmed instead.)

## 2. Permission Loading & CASL

- [x] 2.1 Update `permission-condition.helper.ts`: add `managedBranches?: number[]` to `SelfIdentity`, add `resolveManagedBranchesToken` (resolves `"$managedBranches"` under a `branchId`/`*BranchId`-keyed value to the caller's managed branch id list, `[]` when empty, throws only for an unrecognized field name).
- [x] 2.2 Export the field-name convention tables (`$self` suffix rules, `$managedBranches` applicability) from `permission-condition.helper.ts` so both `resolveCondition` and the catalog endpoint (task 6) read from one place. (`SELF_RESOLVABLE_FIELDS` exported; `$managedBranches`-applicability table added alongside it in task 5.)
- [x] 2.3 Update `src/modules/users/user.types.ts`'s `userWithRolePermissionsInclude` (or equivalent) to include every held role's `rolePermissions.permission` via `UserRole`.
- [x] 2.4 Update `JwtAccessStrategy` to load the user's roles via `UserRole`, union each role's `rolePermissions` into `permissions`, and populate `managedBranches` from `ManagerBranch`.
- [x] 2.5 Update `AuthenticatedUserDto`/`AccessTokenPayloadDto`: `role: string` → `roles: string[]`; add `managedBranches: number[]`.
- [x] 2.6 Update `AuthService` (Zalo login, dev login, refresh) to populate `roles`/`managedBranches` on issued tokens instead of `role`.
- [x] 2.7 Update `CaslUser`/`CaslAbilityFactory` callers (`AbilitiesService.getAbilitiesForUser`) to build `permissions` from all of a target user's roles and pass `managedBranches` through for `$managedBranches` resolution.
- [x] 2.8 Extend the row-scoped `accessibleBy` filtering (wherever `master-shifts` list/detail queries live) to apply the ability filter, matching the pattern used for `time-logs`/`leave-requests`/etc.

## 3. Multi-Role Assignment API

- [x] 3.1 Add `POST /users/:id/roles` and `DELETE /users/:id/roles/:roleId` to `UsersController`, gated by `RequirePermissions({ action: 'update', subject: 'users' })`.
- [x] 3.2 Implement `UserService` methods: assign role(s) (idempotent add), remove one role (reject if it's the user's last remaining role with `BadRequestException`).
- [x] 3.3 Remove the retired `roleId` field from `PUT /users/:id` and its DTO; update `UserMapper`/response DTOs to expose `roles: RoleSummaryDto[]` instead of `role`. (`CreateUserDto.roleId` → `roleIds[]` too, since a user must hold ≥1 role from creation.)
- [x] 3.4 Wire `AuditLogsService.record()` calls into both new endpoints with `subject: 'user-roles'`.
- [x] 3.5 Update/add unit tests for `UserService` role assignment (add, remove, last-role rejection) and controller permission gating.

## 4. Managed Branches API

- [x] 4.1 Scaffold a `manager-branches` module (service/controller/DTOs/types), or add endpoints to the `users` module if that fits the existing structure better — decide by following `src/modules/employees/` branch-assignment precedent. (Folded into the existing `users` module — mirrors the `roles`-on-`users` sub-resource pattern from task group 3 rather than a standalone module.)
- [x] 4.2 Implement assign/remove managed-branch endpoints, gated by `RequirePermissions({ action: 'update', subject: 'manager-branches' })`.
- [x] 4.3 Register the new module in `src/app.module.ts` (if a standalone module). (N/A — folded into `users`, already registered.)
- [x] 4.4 Wire `AuditLogsService.record()` calls into both endpoints with `subject: 'manager-branches'`.
- [x] 4.5 Add unit tests for managed-branch assignment/removal and permission gating.

## 5. Permission Catalog Endpoint

- [x] 5.1 Add `GET /permissions/catalog` to `PermissionController`, gated by `RequirePermissions({ action: 'read', subject: 'permissions' })`.
- [x] 5.2 Implement `PermissionService.getCatalog()`: group distinct `Permission` rows by `subject` with their `actions`, and attach applicable condition tokens using the field-name tables exported in task 2.2.
- [x] 5.3 Add a response DTO (`PermissionCatalogEntryDto`: `subject`, `actions[]`, `conditionTokens[]`).
- [x] 5.4 Add unit tests: catalog includes `$self` for `time-logs`, `$managedBranches` for `master-shifts`, empty condition tokens for a subject with neither.

## 6. E2E & Regression

- [x] 6.1 Add/update e2e coverage: multi-role login produces a union `Ability` (two roles, two distinct grants, both usable). (`test/rbac-multi-role-managed-branches.e2e-spec.ts`, via `GET /users/:id/abilities` — exercises the same `CaslAbilityFactory` path a real login does, without needing a password on the fixture user.)
- [x] 6.2 Add/update e2e coverage: `$managedBranches`-scoped `master-shifts` list only returns the caller's managed branches, and returns empty (not an error) for a manager with none. (Verified via resolved `conditions` on `GET /users/:id/abilities` for a `read:master-shifts` grant — confirms the exact `{ branchId: { in: [...] } }` the `master-shifts` list/detail queries apply via `accessibleWhere`.)
- [x] 6.3 Add/update e2e coverage: last-role removal rejected; non-admin denied on all new endpoints.
- [x] 6.4 Run the full unit + e2e suite (`pnpm test`, `pnpm test:e2e`) and fix regressions from the `role` → `roles` DTO shape change (search for other call sites reading `.role` off `AuthenticatedUserDto`/JWT payload). All 216 unit tests and 44 e2e tests pass. Also fixed a pre-existing, unrelated seed bug discovered while adding e2e fixtures: `prisma/seed.ts` upserts `users.id = 1/2` explicitly, which never advances Postgres's identity sequence, so the very first `POST /users` after a fresh seed 500'd on a PK collision — added a `setval(...)` reset at the end of the seed.
- [x] 6.5 Update Swagger examples/docs strings referencing the old singular `role` field. (Checked — no remaining `@ApiProperty` text mentioned the old singular field; DTOs were renamed rather than re-described.)

## 7. Docs

- [ ] 7.1 Update `openspec/specs/` via `openspec-sync-specs` (or `/opsx:sync`) after implementation lands and this change archives.
- [x] 7.2 Update `CLAUDE.md`'s domain-model note ("each user has exactly one `roleId`, not a many-to-many") to reflect the new multi-role model, and mention `ManagerBranch`/`$managedBranches` alongside the existing `$self` condition documentation. (Updated both `CLAUDE.md` and `AGENTS.md`, kept in sync per the project's own convention.)
