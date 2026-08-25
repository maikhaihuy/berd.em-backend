## ADDED Requirements

### Requirement: Role-permission grants accept a condition via the API
The system SHALL allow `POST /role-permissions` to set an optional
`condition` (a partial Prisma `where` object, `$self`-token-bearing, same
shape as seeded by `prisma/seed.ts`) on each granted `RolePermission` row, in
addition to creating/refreshing the `(roleId, permissionId)` link. Omitting
`condition` for a given grant SHALL leave that grant unconditioned, matching
today's behavior.

`POST /role-permissions` SHALL be additive: it SHALL only create or update
the `(roleId, permissionId)` grants named in the request, and SHALL NOT
remove or otherwise affect any of the role's other existing grants not named
in the request. Removing a grant SHALL continue to require one of the
dedicated `DELETE /role-permissions/role/:roleId/permission/:permissionId`
or `DELETE /role-permissions/role/:roleId` endpoints.

#### Scenario: Assigning a permission with a condition
- **GIVEN** an `Admin` calls `POST /role-permissions` for role `Employee` and
  permission `read`/`time-logs` with `condition: { "employeeId": "$self" }`
- **WHEN** the request completes
- **THEN** the resulting `RolePermission` row has `condition: { "employeeId":
  "$self" }`, and `GET /role-permissions/role/:roleId` returns that
  condition for the grant.

#### Scenario: Assigning a permission without a condition is unchanged
- **GIVEN** an `Admin` calls `POST /role-permissions` for a permission with
  no `condition` supplied
- **WHEN** the request completes
- **THEN** the resulting `RolePermission` row has `condition: null`, matching
  pre-change behavior.

#### Scenario: Re-assigning updates an existing grant's condition
- **GIVEN** a role already holds a `RolePermission` for a given permission
  with `condition: { "employeeId": "$self" }`
- **WHEN** `POST /role-permissions` is called again for the same
  `(roleId, permissionId)` with no `condition` (or a different one)
- **THEN** the existing row's `condition` is updated to the newly supplied
  value (`null` if omitted), not left at its previous value — the upsert
  overwrites `condition` the same way it already overwrites/refreshes the
  link itself.

#### Scenario: Assigning one permission leaves the role's other grants untouched
- **GIVEN** a role already holds grants for `read`/`time-logs` and
  `create`/`time-logs`
- **WHEN** `POST /role-permissions` is called for that role with only
  `read`/`leave-requests` in the request
- **THEN** the role ends up holding all three grants —
  `read`/`time-logs` and `create`/`time-logs` are unaffected, and
  `read`/`leave-requests` is newly added. A "Save" on the permission matrix
  only needs to send the cells that changed, not the role's full grant set.

### Requirement: `Role` exposes `isSystemRole` and cannot be deleted through the API
The system SHALL expose a boolean `isSystemRole` field on `Role` /
`RoleResponseDto`. The seeded `Admin`, `Manager`, and `Employee` roles SHALL
have `isSystemRole: true`; roles created afterward (via `POST /roles`)
SHALL default to `isSystemRole: false`. `DELETE /roles/:id` SHALL reject
deleting a role whose `isSystemRole` is `true`, regardless of caller
permissions — this is not a permission check, it's an invariant on the role
itself.

#### Scenario: Deleting a system role is rejected
- **GIVEN** the seeded `Manager` role, `isSystemRole: true`
- **WHEN** an `Admin` (who holds `delete:roles`) calls `DELETE /roles/:id`
  for it
- **THEN** the system responds `400 Bad Request` and the role is not
  deleted.

#### Scenario: Deleting a non-system role still works
- **GIVEN** a role created via `POST /roles` (`isSystemRole: false`)
- **WHEN** an `Admin` calls `DELETE /roles/:id` for it
- **THEN** the role is deleted, unchanged from today's behavior.

#### Scenario: isSystemRole is visible on read
- **WHEN** a caller with `read`/`roles` calls `GET /roles` or
  `GET /roles/:id`
- **THEN** each role in the response includes its `isSystemRole` value.

### Requirement: `PATCH /roles/:id` no longer accepts `permissionIds`
The system SHALL NOT accept a `permissionIds` field on `PATCH /roles/:id`.
`role-permissions` endpoints (`POST /role-permissions`,
`DELETE /role-permissions/role/:roleId/permission/:permissionId`,
`DELETE /role-permissions/role/:roleId`) SHALL remain the only supported way
to manage a role's permission grants.

#### Scenario: Supplying permissionIds on role update is rejected
- **GIVEN** the global `ValidationPipe` is configured with
  `forbidNonWhitelisted: true`
- **WHEN** a client calls `PATCH /roles/:id` with a `permissionIds` field in
  the body
- **THEN** the system responds `400 Bad Request` (the field is rejected by
  validation) rather than reaching `RoleService.update` and throwing a
  Prisma runtime error.

#### Scenario: Updating a role's other fields still works
- **GIVEN** a client calls `PATCH /roles/:id` with only `name`/`description`
  fields
- **WHEN** the request completes
- **THEN** the role's fields are updated and the response reflects them,
  unaffected by the removal of `permissionIds`.
