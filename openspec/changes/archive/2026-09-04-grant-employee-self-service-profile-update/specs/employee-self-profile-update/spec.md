## ADDED Requirements

### Requirement: Self-service employee profile update endpoint

The system SHALL expose `PATCH /employees/me`, gated by `@SkipPermissions()` (authenticated
callers only, no `update:employees` permission required), that updates the `Employee` record
linked to the caller's own `User` — resolved from the caller's JWT (`employeeId`), never from a
client-supplied identifier. The route SHALL accept only `phoneNumber`, `email`, and `address`; any
other field present in the request body SHALL cause the request to be rejected before any write
occurs. The system SHALL NOT grant the `Employee` role `update:employees` (scoped or otherwise) as
part of this capability.

#### Scenario: A Staff-role caller updates their own contact info

- **GIVEN** an authenticated User with a linked Employee record and no `update:employees`
  permission
- **WHEN** they send `PATCH /employees/me` with `{ "phoneNumber": "...", "email": "...",
  "address": "..." }`
- **THEN** the system responds `200 OK` and the Employee record's `phoneNumber`, `email`, and
  `address` are updated to the submitted values.

#### Scenario: A field outside the whitelist is rejected

- **GIVEN** the same caller as above
- **WHEN** they send `PATCH /employees/me` with a body that includes `fullName`, `branchIds`,
  role, hourly rate, status, or any field other than `phoneNumber`/`email`/`address`
- **THEN** the system responds `400 Bad Request` and does not modify the Employee record.

#### Scenario: A caller with no linked Employee cannot use the route

- **GIVEN** an authenticated User with no linked Employee record (e.g. an Admin-only account)
- **WHEN** they send `PATCH /employees/me`
- **THEN** the system responds `403 Forbidden`.

#### Scenario: The route never targets another caller's Employee record

- **GIVEN** two authenticated Users, each with their own linked Employee record
- **WHEN** one of them sends `PATCH /employees/me`
- **THEN** only their own Employee record is modified — the request carries no identifier capable
  of targeting the other caller's record.

#### Scenario: The existing admin/manager update path is unaffected

- **GIVEN** a caller holding `update:employees` (Admin or Manager)
- **WHEN** they send `PATCH /employees/:id` with a full `UpdateEmployeeDto` payload (including
  `fullName` and `branchIds`) targeting any employee's id
- **THEN** the request succeeds exactly as it did before this change, unaffected by the new route
  or DTO, and the seeded `Employee` role's permission grants are unchanged.
