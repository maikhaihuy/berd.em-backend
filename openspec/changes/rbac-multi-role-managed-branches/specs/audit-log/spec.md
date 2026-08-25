## MODIFIED Requirements

### Requirement: Audited mutations are recorded to an append-only audit log
The system SHALL record one `AuditLog` row (`actorId`, `action`, `subject`,
`entityId`, `before`, `after`, `createdAt`) for every successful create,
update, or delete on the audited subjects: the row-scoped subjects already
enumerated in the `authorization` spec (`time-logs`, `leave-requests`,
`assignments`, `payroll-entries`, `availability`, `attendance-history`,
`master-shifts`) plus the RBAC/admin subjects (`users`, `roles`,
`permissions`, `role-permissions`, `user-roles`, `manager-branches`).
`AuditLog` rows SHALL never be updated or deleted by application code once
written.

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

#### Scenario: Assigning a role to a user is audited
- **WHEN** an admin successfully assigns a role to a user via
  `POST /users/:id/roles`
- **THEN** an `AuditLog` row is written with `subject: "user-roles"`,
  `entityId` equal to the target user's id, and `actorId` equal to the
  admin's user id.

#### Scenario: Assigning a managed branch is audited
- **WHEN** an admin successfully assigns a managed branch to a manager
- **THEN** an `AuditLog` row is written with `subject: "manager-branches"`,
  `entityId` equal to the target user's id, and `actorId` equal to the
  admin's user id.
