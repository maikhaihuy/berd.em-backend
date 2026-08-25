## ADDED Requirements

### Requirement: `$managedBranches` token resolution never fails on an empty list

Unlike `$self` (which throws when the caller lacks the identifier a
condition requires — see "Unresolvable `$self` token denies the request"),
resolving `"$managedBranches"` against a caller with zero `ManagerBranch`
rows SHALL succeed and resolve to an empty array, not throw. An empty array
is a legitimate, filtering-out-everything condition value, not a missing
identifier.

#### Scenario: Caller with no managed branches still gets a resolved (empty) rule

- **GIVEN** a caller whose role grants a permission with
  `condition: { "branchId": { "in": "$managedBranches" } }`, and the caller
  has zero `ManagerBranch` rows
- **WHEN** their `Ability` is built
- **THEN** the rule is included with resolved conditions
  `{ branchId: { in: [] } }` — it is not dropped, and building the `Ability`
  does not log a warning or throw.

## MODIFIED Requirements

### Requirement: Per-request permission loading

The system SHALL load the caller's permissions fresh from the database on each
request inside the JWT access strategy, rather than trusting permissions baked
into the token, so that role/permission changes take effect immediately. The
strategy SHALL load every role the user holds (`roles.rolePermissions.permission`,
including each `RolePermission`'s own `condition`), and expose `permissions`
as the union of `{ action, subject, condition }` entries across all of the
user's roles, for `PermissionsGuard` to build a CASL `Ability` from.

#### Scenario: Permissions resolved from all of the user's roles

- **WHEN** the access token is validated
- **THEN** the strategy loads the user with every held role's
  `rolePermissions.permission` and exposes `permissions` as the union of
  `{ action, subject, condition }` entries across all of them on the
  authenticated user.

#### Scenario: A grant's condition travels with it, not with the shared permission

- **GIVEN** two roles both hold `RolePermission` rows for the same
  `Permission` (`read`/`time-logs`), one with a `condition` set on its
  `RolePermission` row and one without
- **WHEN** each role's user logs in
- **THEN** each user's `permissions` entry for `read`/`time-logs` reflects
  only *that role's* `RolePermission.condition` — never the other role's.

#### Scenario: A user holding both roles gets both grants

- **GIVEN** the same two roles as above, and a single user who holds both of
  them
- **WHEN** that user logs in
- **THEN** their `permissions` list includes two separate `read`/`time-logs`
  entries — one conditioned, one not — so their built `Ability` grants the
  unconditioned access (the broader of the two).

### Requirement: CASL ability construction

The system SHALL build a `@casl/ability` `Ability` (via `@casl/prisma`'s
`createPrismaAbility`) for each authenticated request from the caller's
`permissions` list (the union across all of the caller's roles — see
"Per-request permission loading"), adding one CASL rule per granted
`(action, subject)` entry. When a granted entry carries a `condition`, the
system SHALL resolve `"$self"` tokens in it against the caller's identity
(`employeeId` under an `employeeId` key, `userId` under a `userId` key) and
`"$managedBranches"` tokens against the caller's list of managed branch ids
(see the `managed-branch-scoping` capability), before adding it as that
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

#### Scenario: A managed-branches-conditioned grant becomes a resolved CASL rule

- **GIVEN** a `Manager`'s `read:master-shifts` grant with
  `condition: { "branchId": { "in": "$managedBranches" } }` and the caller's
  managed branch ids are `[1, 2]`
- **WHEN** their `Ability` is built
- **THEN** it includes a rule granting `read` on `master-shifts` with
  resolved conditions `{ branchId: { in: [1, 2] } }`.

#### Scenario: Two roles each contribute their own rules

- **GIVEN** a user holding both `Manager` (unconditioned `read:time-logs`)
  and `Employee` (`read:time-logs` conditioned on `$self`)
- **WHEN** their `Ability` is built
- **THEN** it includes both the unconditioned rule and the conditioned rule,
  so `accessibleBy` matches every row (CASL's own semantics: any one
  matching rule is enough — the unconditioned rule subsumes the conditioned
  one here).

### Requirement: Permission data model and role seeding

The system SHALL model permissions as unique `(action, subject)` rows joined
to roles via `RolePermission`, with each `User` assigned one or more `Role`s
via `UserRole`. `RolePermission` SHALL carry an optional `condition` (a
partial Prisma `where` object, bearing `$self` and/or `$managedBranches`
tokens) scoping that specific role's grant of the permission — independent
of whether any other role's grant of the same `Permission` is conditioned,
and independent of what other roles a given user also happens to hold. The
seed SHALL provision permissions covering every annotated subject and the
base roles, attaching a `condition` directly to the relevant
`RolePermission` entries rather than seeding parallel dedicated permission
rows to fork conditioned and unconditioned grants of the same action apart.

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
  `role-permissions`, `user-roles`, `manager-branches`) and no `update` on
  pay-rates; and `Employee` receives `read` on the schedule plus self-service
  writes (`create` on leave-requests/time-logs/attendance-history, full CRUD
  on availability, and the dedicated `check-in`/`check-out`/`cancel`/`complete`
  actions), but not pay-rates, not the RBAC/admin subjects, not the
  privileged `approve`/`verify`/`generate` actions, and not the coarse
  `update` on assignments/leave-requests/time-logs. `Employee`'s
  `read`/`create` grants on `time-logs`, `leave-requests`, `assignments`,
  `availability`, `attendance-history`, and its `read` grant on
  `payroll-entries`, carry a `RolePermission.condition` scoping them to
  `$self`; `Manager`'s and `Admin`'s grants of the same actions on those
  subjects carry no condition. `check-in`/`check-out` on `assignments` carry
  a `$self` condition on *every* role's grant, since checking in/out is
  inherently self-only regardless of role. Every seeded user (including the
  dev-login employee) holds exactly one `UserRole` row post-migration.

#### Scenario: RBAC/admin subjects are not editable by non-admins

- **GIVEN** the seeded role sets
- **WHEN** a `Manager` attempts to change a user's roles via
  `POST /api/users/:id/roles`
- **THEN** the request is denied `403 Forbidden`, because only `Admin` holds
  permissions on the `users`, `roles`, `permissions`, `role-permissions`,
  `user-roles`, and `manager-branches` subjects (closing the self-promotion
  escalation path).

### Requirement: Row-scoped subjects apply CASL `accessibleBy` filters

The system SHALL apply `accessibleBy(ability, action)[subject]` as an
additional Prisma `where` filter on list/detail queries for `time-logs`,
`leave-requests`, `assignments`, `payroll-entries`, `availability`,
`attendance-history`, and `master-shifts`, so a caller only sees rows their
`Ability`'s rules (including any resolved `$self` or `$managedBranches`
conditions) actually grant.

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

#### Scenario: Branch-scoped list is filtered to the caller's managed branches

- **GIVEN** a `Manager` whose only `read` grant on `master-shifts` carries
  `condition: { "branchId": { "in": "$managedBranches" } }` and whose
  managed branches are Branch A and Branch B
- **WHEN** the manager calls `GET /api/master-shifts`
- **THEN** the response contains only master shifts at Branch A or Branch B.
