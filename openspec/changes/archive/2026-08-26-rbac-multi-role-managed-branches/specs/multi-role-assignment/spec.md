## Purpose

Let a `User` hold more than one `Role` at once, with roles assigned and
removed through dedicated endpoints and permissions aggregated across every
role the caller holds.

## ADDED Requirements

### Requirement: A user holds one or more roles via `UserRole`

The system SHALL model the `User`↔`Role` relationship as many-to-many via a
`UserRole` join table, replacing the single `roleId` foreign key. Every
`User` SHALL hold at least one `Role` at all times.

#### Scenario: A user is created with one role

- **GIVEN** `POST /users` supplies one role id
- **WHEN** the user is created
- **THEN** the user holds exactly that one role via `UserRole`, and
  `GET /users/:id` reports it in `roles`.

#### Scenario: A user is assigned a second role

- **GIVEN** an existing user holding one role
- **WHEN** an admin assigns a second role to that user
- **THEN** the user holds both roles simultaneously, and permissions granted
  by either role are available to them (see the `authorization` capability's
  "CASL ability construction" requirement).

#### Scenario: Migrated users retain their pre-migration role

- **GIVEN** a user created before this change, with a single `roleId`
- **WHEN** the migration that introduces `UserRole` runs
- **THEN** the user ends up holding exactly one role via `UserRole` — the
  same role their `roleId` referenced — with no loss of access.

### Requirement: Role assignment is managed through dedicated endpoints

The system SHALL expose `POST /users/:id/roles` (assign one or more roles)
and `DELETE /users/:id/roles/:roleId` (remove one role), both gated by
`RequirePermissions({ action: 'update', subject: 'users' })`. Both SHALL
replace the retired `roleId` field on `PUT /users/:id`. `DELETE
/users/:id/roles/:roleId` SHALL reject removing a user's last remaining
role.

#### Scenario: Admin assigns an additional role

- **GIVEN** an `Admin` (holding `update:users`) and a target user with one
  role
- **WHEN** the admin calls `POST /users/:id/roles` with a second role id
- **THEN** the request succeeds and the user holds both roles.

#### Scenario: Removing a user's only role is rejected

- **GIVEN** a user holding exactly one role
- **WHEN** an admin calls `DELETE /users/:id/roles/:roleId` for that role
- **THEN** the system responds `400 Bad Request` and the role assignment is
  unchanged.

#### Scenario: Removing one of several roles succeeds

- **GIVEN** a user holding two roles
- **WHEN** an admin calls `DELETE /users/:id/roles/:roleId` for one of them
- **THEN** the user is left holding the other role.

#### Scenario: Non-admin cannot assign or remove roles

- **GIVEN** a caller whose role does not grant `update:users`
- **WHEN** the caller calls `POST /users/:id/roles` or
  `DELETE /users/:id/roles/:roleId`
- **THEN** the system responds `403 Forbidden`.

### Requirement: User responses expose multiple roles

The system SHALL replace the singular `role` field on user response DTOs
with a `roles` array (each entry the same shape a single role summary took
before this change).

#### Scenario: A multi-role user's response lists every role

- **GIVEN** a user holding `Manager` and a custom `Auditor` role
- **WHEN** a caller with `read:users` calls `GET /users/:id`
- **THEN** the response's `roles` array contains both roles.
