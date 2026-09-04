## ADDED Requirements

### Requirement: Seeded Manager role scopes sub-shifts to managed branches

The system SHALL apply a relation-based `$managedBranches` condition
(`{ "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } }`)
to the seeded `Manager` role's grant of the `sub-shifts` subject, since
`SubShift` has no direct `branchId` field and is instead linked to a branch
transitively through its parent `MasterShift`. A `Manager` SHALL only read
sub-shifts whose master shift belongs to a branch the manager is assigned to
via `ManagerBranch`.

#### Scenario: A seeded Manager only lists sub-shifts for branches they manage

- **GIVEN** a user holding only the seeded `Manager` role, with a
  `ManagerBranch` row for Branch A but not Branch B, and sub-shifts under
  master shifts belonging to Branch A and Branch B respectively
- **WHEN** the manager lists sub-shifts
- **THEN** the response includes the Branch A sub-shift and excludes the
  Branch B sub-shift.

#### Scenario: A seeded Manager with no managed branches sees no sub-shifts

- **GIVEN** a user holding only the seeded `Manager` role, with zero
  `ManagerBranch` rows
- **WHEN** they list sub-shifts or fetch one by id
- **THEN** the request succeeds with an empty result (or, for fetch-by-id, a
  `404`), not a `403` or an unfiltered result.

### Requirement: Seeded Manager role scopes tasks to managed branches

The system SHALL apply a relation-based `$managedBranches` condition to the
seeded `Manager` role's grant of the `tasks` subject that covers both ways a
`Task` reaches a branch — directly via `masterShift.branchId` for shared
tasks, or transitively via `subShift.masterShift.branchId` for dedicated
tasks — since exactly one of `Task.masterShiftId`/`Task.subShiftId` is set
per task and neither points at a branch directly:

```json
{
  "OR": [
    { "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } },
    {
      "subShift": {
        "is": {
          "masterShift": {
            "is": { "branchId": { "in": "$managedBranches" } }
          }
        }
      }
    }
  ]
}
```

A `Manager` SHALL only read tasks whose branch (via either path above) is one
they are assigned to manage.

#### Scenario: A seeded Manager sees a shared task on a managed branch's master shift

- **GIVEN** a user holding only the seeded `Manager` role, with a
  `ManagerBranch` row for Branch A, and a `SHARED_MANDATORY` task attached to
  a master shift belonging to Branch A
- **WHEN** the manager lists tasks
- **THEN** the response includes that task.

#### Scenario: A seeded Manager sees a dedicated task on a managed branch's sub-shift

- **GIVEN** the same manager as above, and a `DEDICATED` task attached to a
  sub-shift whose master shift belongs to Branch A
- **WHEN** the manager lists tasks
- **THEN** the response includes that task.

#### Scenario: A seeded Manager does not see tasks outside their managed branches

- **GIVEN** the same manager as above, a shared task on a Branch B master
  shift, and a dedicated task on a Branch B sub-shift (Branch B not managed
  by this manager)
- **WHEN** the manager lists tasks
- **THEN** the response excludes both tasks.

#### Scenario: A seeded Manager with no managed branches sees no tasks

- **GIVEN** a user holding only the seeded `Manager` role, with zero
  `ManagerBranch` rows
- **WHEN** they list tasks or fetch one by id
- **THEN** the request succeeds with an empty result (or, for fetch-by-id, a
  `404`), not a `403` or an unfiltered result.
