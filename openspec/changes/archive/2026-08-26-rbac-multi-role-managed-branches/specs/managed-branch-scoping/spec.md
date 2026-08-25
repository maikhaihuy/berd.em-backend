## Purpose

Let a role-permission grant scope its rows to only the branches a manager
has been assigned to manage, distinct from the branches an employee
personally works at, via a `ManagerBranch` model and a `$managedBranches`
condition token.

## ADDED Requirements

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
