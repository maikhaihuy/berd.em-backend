## ADDED Requirements

### Requirement: Seeded Manager role scopes assignments to managed branches

The system SHALL apply a relation-based `$managedBranches` condition
(`{ "subShift": { "is": { "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } } } }`)
to the seeded `Manager` role's grant of the `assignments` subject, since
`Assignment` has no direct `branchId` field and instead reaches a branch
transitively through its required `subShiftId` → `SubShift.masterShiftId` →
`MasterShift.branchId`. The `Manager` role SHALL keep full CRUD on
`assignments`, but scoped to rows whose branch (via that relation chain) is
one the manager is assigned to via `ManagerBranch`.

#### Scenario: A seeded Manager only lists assignments for branches they manage

- **GIVEN** a user holding only the seeded `Manager` role, with a
  `ManagerBranch` row for Branch A but not Branch B, and `Assignment` rows
  under `SubShift`s belonging to Branch A and Branch B respectively
- **WHEN** the manager lists assignments
- **THEN** the response includes the Branch A assignment and excludes the
  Branch B assignment.

#### Scenario: A seeded Manager with no managed branches sees no assignments

- **GIVEN** a user holding only the seeded `Manager` role, with zero
  `ManagerBranch` rows
- **WHEN** they list assignments or fetch one by id
- **THEN** the request succeeds with an empty result (or, for fetch-by-id, a
  `404`), not a `403` or an unfiltered result.

#### Scenario: A seeded Manager cannot create an assignment on a branch they don't manage

- **GIVEN** a user holding only the seeded `Manager` role, with a
  `ManagerBranch` row for Branch A but not Branch B, and a `SubShift`
  belonging to a Branch B `MasterShift`
- **WHEN** the manager attempts to create an `Assignment` against that
  Branch B `SubShift`
- **THEN** the system denies the write (consistent with how the same
  condition already gates writes on `sub-shifts` and `tasks`).

### Requirement: Seeded Manager role scopes availability (read-only) to managed branches

The system SHALL apply the same relation-based `$managedBranches` condition
used for `assignments`
(`{ "subShift": { "is": { "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } } } }`)
to the seeded `Manager` role's `read`-only grant of the `availability`
subject, since `Availability` reaches a branch through the identical
`subShiftId` → `SubShift.masterShiftId` → `MasterShift.branchId` chain. The
`Manager` role SHALL hold `read` only on `availability` — no `create`,
`update`, or `delete` — scoped to rows whose branch is one the manager is
assigned to via `ManagerBranch`.

#### Scenario: A seeded Manager only lists availability for branches they manage

- **GIVEN** a user holding only the seeded `Manager` role, with a
  `ManagerBranch` row for Branch A but not Branch B, and `Availability` rows
  under `SubShift`s belonging to Branch A and Branch B respectively
- **WHEN** the manager lists availability
- **THEN** the response includes the Branch A row and excludes the Branch B
  row.

#### Scenario: A seeded Manager with no managed branches sees no availability

- **GIVEN** a user holding only the seeded `Manager` role, with zero
  `ManagerBranch` rows
- **WHEN** they list availability or fetch one by id
- **THEN** the request succeeds with an empty result (or, for fetch-by-id, a
  `404`), not a `403` or an unfiltered result.
