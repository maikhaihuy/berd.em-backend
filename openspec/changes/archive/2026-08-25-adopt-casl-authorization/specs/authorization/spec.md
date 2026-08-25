## MODIFIED Requirements

### Requirement: Per-request permission loading

The system SHALL load the caller's permissions fresh from the database on each
request inside the JWT access strategy, rather than trusting permissions baked
into the token, so that role/permission changes take effect immediately. The
strategy SHALL load `role.rolePermissions.permission` including each
`RolePermission`'s own `condition`, and expose `permissions` as a list of
`{ action, subject, condition }` entries (`condition` present only when that
specific grant carries one) on the authenticated user, for
`PermissionsGuard` to build a CASL `Ability` from.

#### Scenario: Permissions resolved from the user's role

- **WHEN** the access token is validated
- **THEN** the strategy loads the user with `role.rolePermissions.permission`
  and exposes `permissions` as a list of `{ action, subject, condition }`
  entries on the authenticated user.

#### Scenario: A grant's condition travels with it, not with the shared permission

- **GIVEN** two roles both hold `RolePermission` rows for the same
  `Permission` (`read`/`time-logs`), one with a `condition` set on its
  `RolePermission` row and one without
- **WHEN** each role's user logs in
- **THEN** each user's `permissions` entry for `read`/`time-logs` reflects
  only *that role's* `RolePermission.condition` — never the other role's.

### Requirement: Required-permission matching

The system SHALL allow a request only when, for **every**
`@RequirePermissions({ action, subject })` rule declared on the route, a CASL
`Ability` built from the caller's granted permissions (see "CASL ability
construction") returns `true` for `ability.can(action, subject)` evaluated as
a **subject-type check** (the subject passed as its type string, not a
fetched instance) — so a rule is satisfied by any matching grant regardless
of whether that grant carries a condition, mirroring CASL's own semantics for
checking access to a subject type before any row is fetched. A missing match
SHALL result in `403 Forbidden`.

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

#### Scenario: A conditioned grant still passes the route-level check

- **GIVEN** a route requiring `{ action: 'read', subject: 'time-logs' }`
- **WHEN** a user whose only grant for `time-logs` carries
  `condition: { "employeeId": "$self" }` calls it
- **THEN** the request is authorized at the route level (the condition
  narrows *which rows* are visible, evaluated separately — see "Row-scoped
  subjects apply CASL `accessibleBy` filters").

### Requirement: Permission data model and role seeding

The system SHALL model permissions as unique `(action, subject)` rows joined
to roles via `RolePermission`, with each `User` assigned exactly one `Role`.
`RolePermission` SHALL carry an optional `condition` (a partial Prisma
`where` object, `$self`-token-bearing) scoping that specific role's grant of
the permission — independent of whether any other role's grant of the same
`Permission` is conditioned. The seed SHALL provision permissions covering
every annotated subject and the base roles, attaching a `condition` directly
to the relevant `RolePermission` entries rather than seeding parallel
dedicated permission rows to fork conditioned and unconditioned grants of the
same action apart.

#### Scenario: Unique action/subject constraint

- **WHEN** permissions are seeded
- **THEN** `(action, subject)` is unique (enforced by a database unique
  index), so re-seeding is idempotent.

#### Scenario: Base role permission sets follow least privilege

- **WHEN** roles are seeded
- **THEN** `Admin` receives every permission; `Manager` receives full CRUD on
  the scheduling and operational subjects, the privileged actions
  (`approve`/`verify`/`generate`, plus `check-in`/`check-out`/`cancel`/`complete`),
  `read` on branches/pay-rates and `create`/`read`/`update` on employees, but
  **no** access to the RBAC/admin subjects (`users`, `roles`, `permissions`,
  `role-permissions`) and no `update` on pay-rates; and `Employee` receives
  `read` on the schedule plus self-service writes (`create` on
  leave-requests/time-logs/attendance-history, full CRUD on availability, and
  the dedicated `check-in`/`check-out`/`cancel`/`complete` actions), but not
  pay-rates, not the RBAC/admin subjects, not the privileged
  `approve`/`verify`/`generate` actions, and not the coarse `update` on
  assignments/leave-requests/time-logs. `Employee`'s `read`/`create` grants
  on `time-logs`, `leave-requests`, `assignments`, `availability`,
  `attendance-history`, and its `read` grant on `payroll-entries`, carry a
  `RolePermission.condition` scoping them to `$self`; `Manager`'s and
  `Admin`'s grants of the same actions on those subjects carry no condition.
  `check-in`/`check-out` on `assignments` carry a `$self` condition on
  *every* role's grant, since checking in/out is inherently self-only
  regardless of role.

#### Scenario: RBAC/admin subjects are not editable by non-admins

- **GIVEN** the seeded role sets
- **WHEN** a `Manager` attempts to change a user's role via
  `PATCH /api/users/:id` (which requires `update:users`)
- **THEN** the request is denied `403 Forbidden`, because only `Admin` holds
  permissions on the `users`, `roles`, `permissions`, and `role-permissions`
  subjects (closing the self-promotion escalation path).

## ADDED Requirements

### Requirement: CASL ability construction

The system SHALL build a `@casl/ability` `Ability` (via `@casl/prisma`'s
`createPrismaAbility`) for each authenticated request from the caller's
`permissions` list, adding one CASL rule per granted `(action, subject)`
entry. When a granted entry carries a `condition`, the system SHALL resolve
`"$self"` tokens in it against the caller's identity (`employeeId` under an
`employeeId` key, `userId` under a `userId` key) before adding it as that
rule's conditions. `PermissionsGuard` SHALL attach the built `Ability` to the
request for handlers/services to use for row-level enforcement.

#### Scenario: An unconditioned grant becomes an unconditioned CASL rule

- **GIVEN** a `Manager`'s unconditioned `read:time-logs` grant
- **WHEN** their `Ability` is built
- **THEN** it includes a rule granting `read` on `time-logs` with no
  conditions, so `accessibleBy(ability, 'read')['time-logs']` matches every
  row.

#### Scenario: A conditioned grant becomes a conditioned CASL rule

- **GIVEN** an `Employee`'s `read:time-logs` grant with
  `condition: { "employeeId": "$self" }` and the caller's `employeeId` is 42
- **WHEN** their `Ability` is built
- **THEN** it includes a rule granting `read` on `time-logs` with resolved
  conditions `{ employeeId: 42 }`.

### Requirement: Row-scoped subjects apply CASL `accessibleBy` filters

The system SHALL apply `accessibleBy(ability, action)[subject]` as an
additional Prisma `where` filter on list/detail queries for `time-logs`,
`leave-requests`, `assignments`, `payroll-entries`, `availability`, and
`attendance-history`, so a caller only sees rows their `Ability`'s rules
(including any resolved conditions) actually grant.

#### Scenario: Self-scoped list is filtered to the caller's own rows

- **GIVEN** an `Employee` whose only `read` grant on `time-logs` carries
  `condition: { "employeeId": "$self" }`
- **WHEN** the employee calls `GET /api/time-tracking`
- **THEN** the response contains only time logs whose `employeeId` matches
  the caller, never another employee's time logs.

#### Scenario: Self-scoped detail read on another employee's row 404s

- **GIVEN** an `Employee` scoped as above
- **WHEN** the employee calls `GET /api/time-tracking/:id` for a time log
  belonging to a different employee
- **THEN** the system responds `404 Not Found` (not `403 Forbidden`), so the
  response does not confirm whether the row exists.

#### Scenario: Unscoped caller is unaffected

- **GIVEN** a `Manager` holding an unconditioned `read:time-logs` grant
- **WHEN** the manager calls `GET /api/time-tracking`
- **THEN** the response contains every employee's time logs, unchanged from
  an unconditioned grant's behavior today.

### Requirement: Unresolvable `$self` token denies the request

The system SHALL deny a request with `403 Forbidden` when a matched grant's
`condition` requires substituting `$self` for an identifier the caller does
not have (e.g. a condition keyed on `employeeId` for a caller with no linked
`Employee`), rather than building an `Ability` rule with an unsatisfiable or
silently-empty condition.

#### Scenario: User with no employee record hits an employee-scoped route

- **GIVEN** a caller whose `AuthenticatedUserDto.employeeId` is undefined
- **WHEN** the caller's only matching grant for the route carries
  `condition: { "employeeId": "$self" }`
- **THEN** the system responds `403 Forbidden` rather than building an
  `Ability` with an unresolved condition.
