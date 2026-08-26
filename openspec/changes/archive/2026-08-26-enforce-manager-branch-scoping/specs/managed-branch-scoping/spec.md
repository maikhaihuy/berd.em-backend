## ADDED Requirements

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
