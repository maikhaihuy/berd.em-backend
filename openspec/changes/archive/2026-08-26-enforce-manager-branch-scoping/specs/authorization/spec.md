## MODIFIED Requirements

### Requirement: Row-scoped subjects apply CASL `accessibleBy` filters

The system SHALL apply `accessibleBy(ability, action)[subject]` as an
additional Prisma `where` filter on list/detail queries for `time-logs`,
`leave-requests`, `assignments`, `payroll-entries`, `availability`,
`attendance-history`, `master-shifts`, `employees`,
`branch-schedule-configs`, `master-shift-templates`, `sub-shift-templates`,
and `task-templates`, so a caller only sees rows their `Ability`'s rules
(including any resolved `$self` or `$managedBranches` conditions) actually
grant.

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

#### Scenario: The seeded Manager role's branch-scheduling reads are filtered

- **GIVEN** the seeded `Manager` role's `read` grants on
  `branch-schedule-configs`, `master-shift-templates`,
  `sub-shift-templates`, and `task-templates` (each conditioned on
  `{ "branchId": { "in": "$managedBranches" } }`), and a caller holding only
  that role with `ManagerBranch` rows for Branch A but not Branch B
- **WHEN** the caller lists any of those four subjects
- **THEN** the response includes only rows for Branch A.

#### Scenario: A relation-based managed-branches condition is applied for employees

- **GIVEN** the seeded `Manager` role's `read` grant on `employees`,
  conditioned on
  `{ "employeeBranches": { "some": { "branchId": { "in": "$managedBranches" } } } }`,
  and a caller holding only that role with a `ManagerBranch` row for
  Branch A
- **WHEN** the caller calls `GET /api/employees`
- **THEN** the response includes only employees with at least one
  `EmployeeBranch` row in Branch A.
