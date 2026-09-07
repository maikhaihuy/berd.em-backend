# Manager Availability Visibility Specification

## Purpose

Let a Manager read registered employee availability for branches they
manage — via the same `GET /availability` endpoint employees already use to
self-register — so a Manager can build the week's schedule from who is
actually available, without granting Manager any write access to
availability data.

## Requirements

### Requirement: Manager can read availability for branches they manage

The system SHALL let a caller holding a `read:availability` grant conditioned
on `$managedBranches` (i.e. a seeded `Manager`) list and fetch any
employee's `Availability` rows for a branch they manage, via the existing
`GET /availability` and `GET /availability/:id` endpoints — with no
role-specific branching in the service layer. Visibility is determined
entirely by the CASL grant resolved for the caller, the same mechanism every
sibling scheduling subject already uses.

#### Scenario: Manager lists availability for a branch they manage

- **GIVEN** a `Manager` with a `ManagerBranch` row for Branch A, and
  `Availability` rows registered by two different employees against
  `SubShift`s under Branch A `MasterShift`s
- **WHEN** the manager calls `GET /availability?date=<date>&branchId=A`
- **THEN** the response includes both employees' registrations for that
  week.

#### Scenario: Manager gets an empty list for a branch they do not manage

- **GIVEN** the same manager as above, with no `ManagerBranch` row for
  Branch B, and `Availability` rows registered against Branch B `SubShift`s
- **WHEN** the manager calls `GET /availability?date=<date>&branchId=B`
- **THEN** the response is an empty array — not a `403` — consistent with
  how `master-shifts`/`assignments` already behave for out-of-scope
  branches.

#### Scenario: Manager fetches a single availability row outside their managed branches

- **GIVEN** the same manager as above, and an `Availability` row id that
  belongs to a Branch B `SubShift`
- **WHEN** the manager calls `GET /availability/:id` with that id
- **THEN** the response is `404 Not Found`.

### Requirement: Employee availability visibility stays self-scoped regardless of query params

The system SHALL continue to restrict an `Employee`-role caller's
`GET /availability` and `GET /availability/:id` results to their own
`Employee` row's registrations, enforced by their `$self`-conditioned grant,
independent of any `branchId` or `subShiftId` query parameter they supply.

#### Scenario: Employee cannot see another employee's registrations via branchId

- **GIVEN** an `Employee` caller with their own `Availability` rows under
  Branch A, and a different employee's `Availability` rows also under
  Branch A
- **WHEN** the employee calls `GET /availability?date=<date>&branchId=A`
- **THEN** the response includes only their own rows.

#### Scenario: Employee omitting branchId still sees only their own rows

- **GIVEN** the same employee as above
- **WHEN** the employee calls `GET /availability?date=<date>` with no
  `branchId`
- **THEN** the response includes only their own rows, same as today's
  behavior.

### Requirement: `subShiftId` query parameter narrows availability results to one slot

The system SHALL accept an optional `subShiftId` query parameter on
`GET /availability`, filtering results to registrations for that specific
`SubShift`, composable with the caller's existing visibility scope (self for
`Employee`, managed branches for `Manager`).

#### Scenario: Manager narrows to who registered for a specific sub-shift

- **GIVEN** a `Manager` managing Branch A, and multiple employees registered
  across several `SubShift`s under Branch A
- **WHEN** the manager calls `GET /availability?date=<date>&subShiftId=<id>`
- **THEN** the response includes only registrations for that `SubShift`.

### Requirement: Manager holds no write access to availability

The system SHALL NOT grant the seeded `Manager` role `create`, `update`, or
`delete` on the `availability` subject — availability stays employee
self-service only (an `Employee` registers/edits/withdraws their own rows),
with `Assignment` creation as the only mechanism that changes an
`Availability` row's status on a Manager's behalf.

#### Scenario: Manager cannot create availability on an employee's behalf

- **GIVEN** a caller holding only the seeded `Manager` role
- **WHEN** they call `POST /availability`
- **THEN** the system responds `403 Forbidden`.

#### Scenario: Manager cannot update or delete another employee's availability

- **GIVEN** a caller holding only the seeded `Manager` role, and an
  `Availability` row owned by a different employee
- **WHEN** they call `PATCH /availability/:id` or `DELETE /availability/:id`
  for that row
- **THEN** the system responds `403 Forbidden`.

### Requirement: Deleting availability enforces ownership via an instance-level CASL check

The system SHALL check `DELETE /availability/:id` against the caller's
resolved `Ability` at the instance level (the same pattern used for
`Assignment` check-in/check-out), rather than a manual employee-id
comparison, and SHALL respond `404 Not Found` (not `403`) when the caller is
neither the owning `Employee` nor an `Admin` — consistent with this
codebase's existing not-found-for-forbidden convention on this endpoint.

#### Scenario: Owning employee deletes their own availability

- **GIVEN** an `Employee` caller and an `Availability` row they own
- **WHEN** they call `DELETE /availability/:id` for that row
- **THEN** the row is deleted and the system responds with a success
  message.

#### Scenario: Non-owning employee cannot delete another employee's availability

- **GIVEN** an `Employee` caller and an `Availability` row owned by a
  different employee
- **WHEN** they call `DELETE /availability/:id` for that row
- **THEN** the system responds `404 Not Found` and the row is not deleted.

#### Scenario: Admin deletes any availability row

- **GIVEN** an `Admin` caller and an `Availability` row owned by any
  employee
- **WHEN** they call `DELETE /availability/:id` for that row
- **THEN** the row is deleted and the system responds with a success
  message.
