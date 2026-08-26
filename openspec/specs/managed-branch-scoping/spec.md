# Managed Branch Scoping Specification

## Purpose

Let a role-permission grant scope its rows to only the branches a manager
has been assigned to manage, distinct from the branches an employee
personally works at, via a `ManagerBranch` model and a `$managedBranches`
condition token.

## Requirements

### Requirement: `ManagerBranch` records manager-to-branch assignments

The system SHALL model which branches a user manages as a `ManagerBranch`
table (`userId`, `branchId`), independent of `EmployeeBranch` (which records
where an employee works, not what they manage). A user MAY manage zero,
one, or many branches.

#### Scenario: A user manages no branches by default

- **WHEN** a user is created
- **THEN** they have no `ManagerBranch` rows until explicitly assigned.

#### Scenario: A manager manages branches they don't personally work at

- **GIVEN** a regional manager with no `EmployeeBranch` rows for Branch A
- **WHEN** they are assigned Branch A via `ManagerBranch`
- **THEN** Branch A appears in their managed branches, independent of
  whether it appears in their own work branches.

### Requirement: Managed-branch assignment endpoints

The system SHALL expose endpoints to assign and remove a user's managed
branches (`POST`/`DELETE` on a `manager-branches` resource), gated by
`RequirePermissions({ action: 'update', subject: 'manager-branches' })`.

#### Scenario: Admin assigns a managed branch

- **GIVEN** an `Admin` holding `update:manager-branches`
- **WHEN** they assign Branch A to a manager
- **THEN** the manager's managed branches include Branch A.

#### Scenario: Non-admin cannot assign managed branches

- **GIVEN** a caller whose role does not grant `update:manager-branches`
- **WHEN** they attempt to assign a managed branch
- **THEN** the system responds `403 Forbidden`.

### Requirement: `$managedBranches` condition token

A `RolePermission.condition` MAY reference `"$managedBranches"` the same way
it references `"$self"`. The system SHALL resolve it, per the `authorization`
capability's condition-resolution mechanism, to the caller's list of managed
branch ids (from `ManagerBranch`), for use against a `branchId`-bearing field
(typically with Prisma's `in` operator, e.g.
`{ "branchId": { "in": "$managedBranches" } }`). An empty managed-branches
list is a valid resolution (the caller manages no branches) — the condition
resolves to an empty array, filtering out all rows, rather than being
treated as an error.

#### Scenario: A manager sees only rows for branches they manage

- **GIVEN** a `Manager` role holding `read:master-shifts` with
  `condition: { "branchId": { "in": "$managedBranches" } }`, and a caller
  whose `ManagerBranch` rows are Branch A and Branch B
- **WHEN** the caller lists master shifts
- **THEN** the response includes only master shifts whose `branchId` is A
  or B.

#### Scenario: A manager with no managed branches sees nothing, not an error

- **GIVEN** the same grant as above, but the caller has zero `ManagerBranch`
  rows
- **WHEN** the caller lists master shifts
- **THEN** the request succeeds with an empty result — the rule is not
  dropped and the request is not denied, unlike an unresolvable `$self`.

### Requirement: Seeded Manager role scopes branch-scheduling subjects to managed branches

The system SHALL apply the `$managedBranches` condition
(`{ "branchId": { "in": "$managedBranches" } }`) to the seeded `Manager`
role's grant of every branch-scheduling subject that carries a direct
`branchId` field: `branch-schedule-configs`, `master-shift-templates`,
`sub-shift-templates`, `task-templates`, and `master-shifts`. A `Manager`
SHALL only read, create, update, or delete rows on these subjects for
branches present in their own `ManagerBranch` assignments.

#### Scenario: A seeded Manager only lists master shifts for branches they manage

- **GIVEN** a user holding only the seeded `Manager` role, with `ManagerBranch`
  rows for Branch A but not Branch B
- **WHEN** they list master shifts
- **THEN** the response includes master shifts for Branch A and excludes any
  for Branch B.

#### Scenario: A seeded Manager with no managed branches sees no scheduling rows

- **GIVEN** a user holding only the seeded `Manager` role, with zero
  `ManagerBranch` rows
- **WHEN** they list master shifts, master-shift templates, sub-shift
  templates, task templates, or branch schedule configs
- **THEN** each request succeeds with an empty result, not a `403` or an
  unfiltered list.

### Requirement: Seeded Manager role scopes employees to managed branches

The system SHALL apply a relation-based `$managedBranches` condition
(`{ "employeeBranches": { "some": { "branchId": { "in": "$managedBranches" } } } }`)
to the seeded `Manager` role's grant of the `employees` subject, since
`Employee` has no direct `branchId` field and is instead linked to branches
via `EmployeeBranch`. A `Manager` SHALL only read or update employee records
that have at least one `EmployeeBranch` row in a branch the manager is
assigned to via `ManagerBranch`.

#### Scenario: A seeded Manager only lists employees assigned to a managed branch

- **GIVEN** a user holding only the seeded `Manager` role, with a
  `ManagerBranch` row for Branch A, and an employee whose only
  `EmployeeBranch` row is Branch A
- **WHEN** the manager lists employees
- **THEN** the response includes that employee.

#### Scenario: A seeded Manager does not see employees outside their managed branches

- **GIVEN** the same manager as above, and a second employee whose only
  `EmployeeBranch` row is Branch B (not managed by this manager)
- **WHEN** the manager lists employees
- **THEN** the response excludes the second employee.
