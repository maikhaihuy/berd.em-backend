## 1. Fix the broken `PATCH /roles/:id` write path

- [x] 1.1 Remove `permissionIds` from `src/modules/roles/dto/update-role.dto.ts`.
- [x] 1.2 Remove the `permissions: { set: ... } }` block and the now-unused
      `permissionIds` verification logic from `RoleService.update`
      (`src/modules/roles/role.service.ts`). Also found and fixed a second,
      separate bug in the same method while writing e2e coverage: the
      duplicate-name check ran unconditionally, and `where: { name:
      undefined }` is silently dropped by Prisma — so a description-only
      update (no `name` field at all) matched the first *other* role in the
      table and false-positived as "Role with this name already exists".
      Now guarded behind `updateRoleDto.name !== undefined`.
- [x] 1.3 Update/add a unit test in `role.service.spec.ts` asserting a
      `permissionIds` field in the update payload is stripped/rejected
      rather than reaching Prisma. Also added a regression test for the
      duplicate-name bug fix above.
- [x] 1.4 Add/update an e2e case asserting `PATCH /roles/:id` with a
      `permissionIds` body returns `400`, and with only `name`/`description`
      still succeeds. Added `test/permission-admin-api.e2e-spec.ts`.

## 2. Add `condition` support to role-permission assignment

- [x] 2.1 Update `AssignPermissionsDto`
      (`src/modules/role-permissions/dto/assign-permission.dto.ts`) so each
      permission id can carry an optional `condition`. Resolved the shape
      question: `permissionIds: number[]` replaced by `grants: {
      permissionId: number; condition?: object }[]` (a new nested
      `PermissionGrantDto`, validated with `@ValidateNested`).
- [x] 2.2 Update `RolePermissionResponseDto`
      (`src/modules/role-permissions/dto/role-permission-response.dto.ts`)
      to include `condition`.
- [x] 2.3 Update `role-permissions.types.ts`'s include/select and
      `RolePermissionMapper.toDto(s)` to surface `condition`. (`condition`
      is a scalar on `RolePermission`, already present on every query result
      regardless of `include` — only the mapper needed updating.)
- [x] 2.4 Update `RolePermissionsService.assignPermissions` to pass
      `condition` into both the `create` and `update` branches of the
      `rolePermission.upsert` call (overwriting on re-assignment per the
      spec's "Re-assigning updates an existing grant's condition"
      scenario). Uses `Prisma.JsonNull` (not `null`) to explicitly clear a
      `Json?` field on update, per Prisma's own convention.
- [x] 2.5 Update/add unit tests in `role-permissions.service.spec.ts`
      covering: assigning with a condition, assigning without one,
      re-assigning to change/clear a condition, and the spec's "Assigning
      one permission leaves the role's other grants untouched" scenario
      (confirms the existing additive upsert behavior with a regression
      test, no code change needed for this part).
- [x] 2.6 Update/add e2e coverage for the assign → list → condition
      round-trip, including one case that asserts a second, narrower
      `POST /role-permissions` call doesn't remove the role's earlier
      grants.

## 3. `Role.isSystemRole`

- [x] 3.1 Add `isSystemRole Boolean @default(false)` to `Role` in
      `prisma/schema.prisma`; run `pnpm db:dev --name add-role-is-system-role`.
      (`prisma migrate dev` refuses to run non-interactively in this shell —
      used `prisma migrate diff` + a hand-placed migration folder +
      `prisma migrate deploy`, same workaround as the earlier CASL change.)
- [x] 3.2 Update `prisma/seed.ts` to set `isSystemRole: true` on the
      `Admin`, `Manager`, and `Employee` role upserts.
- [x] 3.3 Add `isSystemRole` to `RoleResponseDto` and `RoleMapper.toDto(s)`.
- [x] 3.4 In `RoleService.remove`, load the role first and throw
      `BadRequestException` if `isSystemRole` is `true`, before attempting
      the delete.
- [x] 3.5 Add unit tests in `role.service.spec.ts`: deleting a system role
      throws `BadRequestException` without calling `prisma.role.delete`;
      deleting a non-system role still works.
- [x] 3.6 Add e2e coverage: `DELETE /roles/:id` for the seeded `Manager`
      role returns `400`; for a freshly created role it returns `204`.

## 4. Fail-closed condition resolution: drop the rule, log a warning, never throw

- [x] 4.1 Change `CaslAbilityFactory.createForUser()` (or the
      `permission-condition.helper.ts` resolution call it makes) to wrap
      each grant's `resolveCondition` call individually: on failure, log a
      warning via `LoggerService` with `{ subject, action, reason }` and
      skip adding that one rule, instead of letting the exception propagate.
      `CaslModule` now imports `ExceptionModule` to get `LoggerService`
      (previously only injected into filters, not a feature service).
- [x] 4.2 Remove the now-unneeded assumption in `PermissionsGuard` that
      ability construction can throw for a bad condition (it no longer can);
      simplify/adjust any surrounding error handling accordingly. Turned out
      to be a no-op: the guard never had an explicit try/catch around
      `createForUser()` — it relied on the exception propagating up through
      Nest's own filters — so making `createForUser()` never throw was
      sufficient on its own.
- [x] 4.3 Update `src/common/guards/permissions.guard.spec.ts` and/or
      `casl-ability.factory.spec.ts`: a caller whose only grant for a
      required `(action, subject)` has an unresolvable condition is denied
      the route (no surviving rule satisfies it) but via the normal
      insufficient-permissions path, not a thrown/uncaught error; a caller
      with one resolvable and one unresolvable grant is still authorized via
      the resolvable one.
- [x] 4.4 Add a unit test asserting the warning is logged with the expected
      fields when a condition fails to resolve.

## 5. Audit log data model

- [x] 5.1 Add an `AuditLog` model to `prisma/schema.prisma`: `id Int
      @id @default(autoincrement())`, `actorId Int`, `action String`,
      `subject String`, `entityId Int`, `before Json?`, `after Json?`,
      `createdAt DateTime @default(now())`, with an index on `(subject,
      createdAt)` and on `actorId` to support the list endpoint's filters.
- [x] 5.2 Run `pnpm db:dev --name add-audit-log` to generate and apply the
      migration. (Same non-interactive workaround as the other migrations in
      this change.)
- [x] 5.3 Scaffold `src/modules/audit-logs/` (module, service, controller,
      mapper, types, DTOs) following the reference module structure in
      `src/modules/employees/`. Also wrote `GET /audit-logs` (task 7.1-7.3)
      and seeded the `read:audit-logs` and `read:user-abilities` permissions
      (task 7.2/6.1) at the same time, since they were natural to build
      alongside the module scaffold — see group 7 below for the checkmarks.
- [x] 5.4 Register `AuditLogsModule` in `src/app.module.ts`.

## 6. Wire audit recording into mutation services

- [x] 6.1 Add an `AuditLogService.record({ actorId, action, subject,
      entityId, before, after })` method (plain insert, no business logic).
- [x] 6.2 Add `record()` calls to the create/update/delete methods of the
      row-scoped subjects (`time-logs`, `leave-requests`, `assignments`,
      `payroll-entries`, `availability`, `attendance-history`) — inside the
      existing `$transaction` where one already wraps the write, otherwise
      as an immediately-following call. `PayrollEntryService.generate()`
      needed `AuditLogsService.record()` to accept an optional
      `Prisma.TransactionClient` so the audit insert stays inside the same
      `$transaction` as the generation write.
- [x] 6.3 Add the same `record()` calls to the RBAC/admin subjects'
      mutation methods (`users`, `roles`, `permissions`, `role-permissions`).
      `UsersService.create/update/remove` and `UsersController` gained a
      `currentUserId` parameter (via `@AuthenticatedUser()`) since neither
      previously threaded the caller through.
- [x] 6.4 Add unit tests per touched service asserting a successful mutation
      calls `AuditLogService.record` with the expected `action`/`subject`,
      and a failed/rejected mutation does not call it. Added
      `src/modules/users/user.service.spec.ts` from scratch (no prior spec
      existed for this service); all other touched services already had
      specs updated with matching audit-call assertions.

## 7. Audit log list endpoint

- [x] 7.1 Implement `GET /audit-logs` with `subject`, `actorId`, `entityId`,
      and `createdAt` range query params, newest-first ordering, and
      pagination (matched `AttendanceHistoryFilterDto`'s page/limit
      convention — the nearest existing paginated list endpoint).
- [x] 7.2 Add a `read`/`audit-logs` permission row and seed it onto `Admin`
      only, in `prisma/seed.ts`.
- [x] 7.3 Guard the controller with `@RequirePermissions({ action: 'read',
      subject: 'audit-logs' })`.
- [x] 7.4 Add unit tests for filtering (by subject, by actor) and pagination
      ordering. Added `src/modules/audit-logs/audit-logs.service.spec.ts`
      (also covers `entityId`/date-range filters and the transaction-client
      pass-through on `record()`).
- [x] 7.5 Add e2e coverage: a non-admin request 403s; an admin request
      returns seeded/generated rows in the expected order. Added a
      `GET /audit-logs` describe block to
      `test/permission-admin-api.e2e-spec.ts`, reusing the rows generated by
      the earlier `role-permissions` test cases in the same file.

## 8. Abilities endpoints: self and admin-scoped

- [x] 8.1 Add a `read`/`user-abilities` permission row in `prisma/seed.ts`,
      seeded onto `Admin` only. (Already added alongside `read:audit-logs`
      when the audit-logs module was scaffolded in task 5.3.)
- [x] 8.2 Implement `GET /me/abilities` (`src/modules/abilities/me.controller.ts`,
      a small dedicated controller/module), `@SkipPermissions()`, building
      the caller's own `Ability` via `CaslAbilityFactory.createForUser()`
      from data already available on the authenticated request (no extra
      user lookup — `AbilitiesService.getAbilitiesForCaller` takes the
      already-loaded `AuthenticatedUserDto` directly).
- [x] 8.3 Implement `GET /users/:id/abilities` (added to
      `UsersController`, backed by `AbilitiesService.getAbilitiesForUser`)
      that loads the target user via `userWithRolePermissionsInclude`,
      builds the same `{ userId, employeeId, permissions }` shape
      `JwtAccessStrategy.validate` builds, and calls
      `CaslAbilityFactory.createForUser()`. Guarded with
      `@RequirePermissions({ action: 'read', subject: 'user-abilities' })`.
- [x] 8.4 Serialize both endpoints' built `Ability` rules to `{ action,
      subject, inverted, conditions }[]` (`AbilitiesService.serialize`,
      shared by both call paths), relying on task 4's drop-rule behavior for
      any unresolvable grant (no per-endpoint try/catch needed).
- [x] 8.5 Add unit tests (`src/modules/abilities/abilities.service.spec.ts`):
      `getAbilitiesForCaller` resolves against the caller's own identity with
      no extra Prisma query and omits an unresolvable rule rather than
      erroring; `getAbilitiesForUser` resolves against the *target's*
      identity (not the caller's) and throws `NotFoundException` for a
      missing user.
- [x] 8.6 Add e2e coverage (`test/permission-admin-api.e2e-spec.ts`): any
      authenticated user gets `200` from `/me/abilities`; a non-admin caller
      gets `403` from `/users/:id/abilities`; an admin caller gets the
      expected resolved rule set for the seeded dev Employee, and a `404`
      for a non-existent user id.

## 9. Docs

- [x] 9.1 Update `CLAUDE.md`/`AGENTS.md` to note the audit-log call
      convention (new mutations on audited subjects must call
      `AuditLogService.record`), mirroring how `@RequirePermissions` is
      already documented as a manual per-route convention.
- [x] 9.2 Update `CLAUDE.md`/`AGENTS.md`'s authorization section to describe
      the drop-rule/log-warning condition resolution behavior (task 4). (The
      "unresolvable `$self` denies the request" description didn't
      previously exist in either doc — this change adds the drop-rule
      behavior as new documentation, along with the two abilities
      endpoints and `Role.isSystemRole` that depend on it.)
