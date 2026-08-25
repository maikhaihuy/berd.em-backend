## ADDED Requirements

### Requirement: Audited mutations are recorded to an append-only audit log
The system SHALL record one `AuditLog` row (`actorId`, `action`, `subject`,
`entityId`, `before`, `after`, `createdAt`) for every successful create,
update, or delete on the audited subjects: the row-scoped subjects already
enumerated in the `authorization` spec (`time-logs`, `leave-requests`,
`assignments`, `payroll-entries`, `availability`, `attendance-history`) plus
the RBAC/admin subjects (`users`, `roles`, `permissions`,
`role-permissions`). `AuditLog` rows SHALL never be updated or deleted by
application code once written.

#### Scenario: Creating a leave request is audited
- **WHEN** an employee successfully creates a `LeaveRequest` via
  `POST /leave-requests`
- **THEN** an `AuditLog` row is written with `action: "create"`,
  `subject: "leave-requests"`, `entityId` equal to the new leave request's
  id, `actorId` equal to the caller's user id, and `after` capturing the
  created row.

#### Scenario: Updating a role's grants is audited
- **WHEN** an admin successfully assigns a permission to a role via
  `POST /role-permissions`
- **THEN** an `AuditLog` row is written with `subject: "role-permissions"`
  and `actorId` equal to the admin's user id.

#### Scenario: A failed mutation is not audited
- **GIVEN** a `POST /time-tracking` request that fails validation
- **WHEN** the request is rejected before any Prisma write occurs
- **THEN** no `AuditLog` row is written for that request.

### Requirement: Audit log is queryable via a paginated, filterable list endpoint
The system SHALL expose `GET /audit-logs`, gated by
`RequirePermissions({ action: 'read', subject: 'audit-logs' })`, supporting
filtering by `subject`, `actorId`, `entityId`, and a `createdAt` date range,
and returning results in reverse-chronological order with pagination.

#### Scenario: Filtering by subject
- **WHEN** an admin calls `GET /audit-logs?subject=leave-requests`
- **THEN** the response contains only audit log rows with
  `subject: "leave-requests"`.

#### Scenario: Filtering by actor
- **WHEN** an admin calls `GET /audit-logs?actorId=7`
- **THEN** the response contains only audit log rows with `actorId: 7`.

#### Scenario: Results are paginated and newest-first
- **GIVEN** more audit log rows exist than one page size
- **WHEN** an admin calls `GET /audit-logs` with no further filters
- **THEN** the first page's rows are ordered by `createdAt` descending, and
  a subsequent page can be requested without duplicating or skipping rows.

#### Scenario: Non-admin cannot read the audit log
- **GIVEN** a caller whose role does not grant `read`/`audit-logs`
- **WHEN** the caller calls `GET /audit-logs`
- **THEN** the system responds `403 Forbidden`.
