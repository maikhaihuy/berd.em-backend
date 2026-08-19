# Authorization Specification

## Purpose

Define how the StaffHub backend authorizes authenticated requests. Authorization
is a simple permission-based RBAC model enforced **globally, deny-by-default**:
every request is authenticated by `JwtAccessGuard` and then authorized by
`PermissionsGuard`, which compares the route's declared `(action, subject)`
requirements against the permissions granted to the caller's role.

This capability replaces the earlier, unused CASL layer (now removed). The
permission data model is `Permission(action, subject)` → `RolePermission` →
a single `Role` per `User`.

## Requirements

### Requirement: Global authentication guard

The system SHALL authenticate every request with `JwtAccessGuard` (passport
`jwt` strategy) registered globally, before any authorization check runs.

#### Scenario: Missing or invalid token on a protected route

- **GIVEN** a route that is not marked `@Public()`
- **WHEN** a request arrives with no bearer token or an invalid/expired one
- **THEN** the system responds `401 Unauthorized` and never reaches
  `PermissionsGuard`.

#### Scenario: Valid token

- **GIVEN** a route that is not marked `@Public()`
- **WHEN** a request arrives with a valid access token
- **THEN** the authenticated user is attached to the request and evaluation
  proceeds to `PermissionsGuard`.

### Requirement: Per-request permission loading

The system SHALL load the caller's permissions fresh from the database on each
request inside the JWT access strategy, rather than trusting permissions baked
into the token, so that role/permission changes take effect immediately.

#### Scenario: Permissions resolved from the user's role

- **WHEN** the access token is validated
- **THEN** the strategy loads the user with `role.rolePermissions.permission`
  and exposes `permissions` as a list of `{ action, subject }` pairs on the
  authenticated user.

### Requirement: Global authorization guard is deny-by-default

The system SHALL authorize every non-public request with `PermissionsGuard`
registered globally after `JwtAccessGuard`. A protected route that declares
none of `@Public()`, `@SkipPermissions()`, or `@RequirePermissions()` SHALL be
denied.

#### Scenario: Protected route with no authorization annotation

- **GIVEN** an authenticated request to a route with no authorization decorator
- **WHEN** `PermissionsGuard` evaluates the route
- **THEN** the system responds `403 Forbidden` (deny-by-default).

#### Scenario: Authenticated user is absent

- **GIVEN** a route reaches `PermissionsGuard`
- **WHEN** no authenticated user is present on the request
- **THEN** the system responds `403 Forbidden`.

### Requirement: Public routes bypass authentication and authorization

The system SHALL allow routes annotated with `@Public()` to be reached without a
token and without any permission check. Both `JwtAccessGuard` and
`PermissionsGuard` SHALL honor this annotation.

#### Scenario: Login endpoint is reachable without a token

- **GIVEN** `POST /api/auth/login/zalo` (or `login`, `refresh`, `dev/login`)
  annotated `@Public()`
- **WHEN** a request arrives with no bearer token
- **THEN** the route handler executes (any resulting failure comes from the
  handler's own logic, not from the guards).

### Requirement: Skip-permissions routes require authentication only

The system SHALL allow routes annotated with `@SkipPermissions()` to run for any
authenticated user without a specific `(action, subject)` permission. These are
authenticated self-service routes (e.g. logout, active sessions).

#### Scenario: Self-service route for a non-privileged user

- **GIVEN** `GET /api/auth/active-sessions` annotated `@SkipPermissions()`
- **WHEN** an authenticated user with no elevated permissions calls it
- **THEN** the system responds `200 OK`.

### Requirement: Required-permission matching

The system SHALL allow a request only when, for **every**
`@RequirePermissions({ action, subject })` rule declared on the route, the
caller's granted permissions contain a matching pair. A missing match SHALL
result in `403 Forbidden`.

#### Scenario: Caller holds the required permission

- **GIVEN** a route requiring `{ action: 'read', subject: 'branches' }`
- **WHEN** a user whose role grants `read`/`branches` calls it
- **THEN** the system responds with the handler's success result.

#### Scenario: Caller lacks the required permission

- **GIVEN** a route requiring `{ action: 'create', subject: 'branches' }`
- **WHEN** a user whose role grants only `read`/`branches` calls it
- **THEN** the system responds `403 Forbidden`.

#### Scenario: Multiple required rules use AND semantics

- **GIVEN** a route declaring more than one required permission
- **WHEN** the caller matches some but not all of the rules
- **THEN** the system responds `403 Forbidden`.

### Requirement: Wildcard permissions

The system SHALL treat `action === 'manage'` as matching any action and
`subject === 'all'` as matching any subject, so that an administrator granted
`manage`/`all` satisfies every requirement.

#### Scenario: Administrator with manage/all

- **GIVEN** a user whose role grants `manage`/`all`
- **WHEN** the user calls any route requiring a specific `(action, subject)`
- **THEN** the requirement is satisfied and the request is authorized.

### Requirement: Dedicated actions for privileged sub-operations

The system SHALL model privileged or self-service sub-operations as their own
`(action, subject)` permissions rather than folding them into the generic
`update`, so a role can hold a self-service action without gaining full edit
rights over the subject. These actions are: `check-in`/`check-out` on
`assignments`, `approve`/`cancel` on `leave-requests`, `verify` on `time-logs`,
`generate` on `master-shifts`, and `complete` on `tasks`. The routes for those
operations SHALL require the dedicated action.

#### Scenario: Employee checks in without full assignment edit rights

- **GIVEN** an `Employee` granted `check-in`/`check-out` on `assignments` but not
  `update:assignments`
- **WHEN** the employee calls `POST /api/assignments/:id/check-in`
- **THEN** the request is authorized, while `PATCH /api/assignments/:id` (which
  requires `update:assignments`) is denied `403 Forbidden`.

#### Scenario: Privileged actions are withheld from employees

- **GIVEN** the seeded `Employee` role
- **WHEN** the employee calls `PUT /api/leave-requests/:id/approve`
  (`approve:leave-requests`), `PUT /api/time-tracking/:id/verify`
  (`verify:time-logs`), or `POST /api/master-shifts/generate`
  (`generate:master-shifts`)
- **THEN** each request is denied `403 Forbidden`, since only `Manager`/`Admin`
  hold those actions.

#### Scenario: Setting pay is gated by the pay-rate subject

- **GIVEN** `POST /api/employees/:id/hourly-rates` requires
  `update:employee-hourly-rates`
- **WHEN** a `Manager` (who holds only `read` on `employee-hourly-rates`) calls it
- **THEN** the request is denied `403 Forbidden`; only `Admin` may set pay rates.

### Requirement: Permission data model and role seeding

The system SHALL model permissions as unique `(action, subject)` rows joined to
roles via `RolePermission`, with each `User` assigned exactly one `Role`. The
seed SHALL provision permissions covering every annotated subject and the base
roles.

#### Scenario: Unique action/subject constraint

- **WHEN** permissions are seeded
- **THEN** `(action, subject)` is unique (enforced by a database unique index),
  so re-seeding is idempotent.

#### Scenario: Base role permission sets follow least privilege

- **WHEN** roles are seeded
- **THEN** `Admin` receives every permission; `Manager` receives full CRUD on
  the scheduling and operational subjects, the privileged actions
  (`approve`/`verify`/`generate`, plus `check-in`/`check-out`/`cancel`/`complete`),
  `read` on branches/pay-rates and `create`/`read`/`update` on employees, but
  **no** access to the RBAC/admin subjects (`users`, `roles`, `permissions`,
  `role-permissions`) and no `update` on pay-rates; and `Employee` receives
  `read` on the schedule plus self-service writes (`create` on
  leave-requests/time-logs/attendance-history, full CRUD on availability, and the
  dedicated `check-in`/`check-out`/`cancel`/`complete` actions), but not
  pay-rates, not the RBAC/admin subjects, not the privileged
  `approve`/`verify`/`generate` actions, and not the coarse `update` on
  assignments/leave-requests/time-logs.

#### Scenario: RBAC/admin subjects are not editable by non-admins

- **GIVEN** the seeded role sets
- **WHEN** a `Manager` attempts to change a user's role via `PATCH /api/users/:id`
  (which requires `update:users`)
- **THEN** the request is denied `403 Forbidden`, because only `Admin` holds
  permissions on the `users`, `roles`, `permissions`, and `role-permissions`
  subjects (closing the self-promotion escalation path).
