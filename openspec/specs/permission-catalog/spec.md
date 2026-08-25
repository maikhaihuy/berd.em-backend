# Permission Catalog Specification

## Purpose

Let the frontend build a condition editor without hardcoding which
`$self`/`$managedBranches` field-name conventions apply to which permission
subject, by exposing that convention through an endpoint instead of leaving
it implicit in backend code.

## Requirements

### Requirement: `GET /permissions/catalog` documents supported condition tokens per subject

The system SHALL expose `GET /permissions/catalog`, gated by
`RequirePermissions({ action: 'read', subject: 'permissions' })`, returning
every permission subject alongside the actions defined on it and the
condition tokens usable in a `RolePermission.condition` for that subject:
`$self` (with the field-name suffix convention it resolves against —
`employeeId`/`*EmployeeId`, `userId`/`*UserId`) where the subject has a
matching field, and `$managedBranches` (resolved against a `branchId`
field) where the subject has one. A subject with neither a self-resolvable
field nor a `branchId` field SHALL be listed with an empty condition-tokens
set, not omitted.

#### Scenario: Catalog lists every permission subject

- **WHEN** a caller with `read:permissions` calls `GET /permissions/catalog`
- **THEN** the response includes one entry per distinct `subject` present in
  the `Permission` table, each listing its available `actions`.

#### Scenario: Catalog documents the `$self` convention for a self-scopable subject

- **GIVEN** `time-logs` has an `employeeId` field
- **WHEN** the caller requests the catalog
- **THEN** the `time-logs` entry's condition tokens include `$self`,
  documented as resolving via the `employeeId` field.

#### Scenario: Catalog documents `$managedBranches` for a branch-scopable subject

- **GIVEN** `master-shifts` has a `branchId` field
- **WHEN** the caller requests the catalog
- **THEN** the `master-shifts` entry's condition tokens include
  `$managedBranches`, documented as resolving via the `branchId` field.

#### Scenario: Non-permission-reader cannot call the endpoint

- **GIVEN** a caller whose role does not grant `read:permissions`
- **WHEN** the caller calls `GET /permissions/catalog`
- **THEN** the system responds `403 Forbidden`.
