## MODIFIED Requirements

### Requirement: Self-scoped effective-abilities lookup

The system SHALL expose `GET /me/abilities` to any authenticated user
(`@SkipPermissions()` — no specific `(action, subject)` grant required
beyond being logged in, the same posture as other self-service routes like
`/auth/active-sessions`), which builds an `Ability` via
`CaslAbilityFactory.createForUser()` from the union of the caller's own
roles' and role-permission grants across every role they hold, and returns
the resulting granted rules as `{ action, subject, condition }[]` —
reflecting what the caller would actually be authorized for, not the raw
`RolePermission` rows.

#### Scenario: A caller inspects their own resolved abilities

- **GIVEN** an `Employee` whose role grants `read`/`time-logs` with
  `condition: { "employeeId": "$self" }`, and whose own `employeeId` is `42`
- **WHEN** that employee calls `GET /me/abilities`
- **THEN** the response includes a rule for `read`/`time-logs` with
  `condition: { "employeeId": 42 }` (resolved), not the literal `"$self"`
  token.

#### Scenario: Any authenticated user can call the endpoint

- **GIVEN** any authenticated caller, regardless of role or granted
  permissions
- **WHEN** the caller calls `GET /me/abilities`
- **THEN** the system responds `200 OK` with that caller's own resolved
  rules — never `403 Forbidden` for lack of a specific permission.

#### Scenario: A multi-role caller sees rules from every role they hold

- **GIVEN** a caller holding both `Manager` and a custom `Auditor` role,
  each granting a different permission
- **WHEN** that caller calls `GET /me/abilities`
- **THEN** the response includes rules from both roles' grants.

### Requirement: Admin-scoped effective-abilities lookup for a target user

The system SHALL expose `GET /users/:id/abilities`, gated by
`RequirePermissions({ action: 'read', subject: 'user-abilities' })`, which
loads the target user's roles and role-permission grants across all of them
(the same shape `JwtAccessStrategy` loads for the caller), builds an
`Ability` via `CaslAbilityFactory.createForUser()` using the target user's
own identity for `$self`/`$managedBranches` resolution, and returns the
resulting granted rules as `{ action, subject, condition }[]` — reflecting
what that user would actually be authorized for, not the raw
`RolePermission` rows.

#### Scenario: Looking up an employee's resolved abilities

- **GIVEN** an `Employee` whose role grants `read`/`time-logs` with
  `condition: { "employeeId": "$self" }`, and that employee's `employeeId`
  is `42`
- **WHEN** an admin calls `GET /users/:id/abilities` for that user
- **THEN** the response includes a rule for `read`/`time-logs` with
  `condition: { "employeeId": 42 }` (resolved), not the literal `"$self"`
  token.

#### Scenario: Looking up a manager's unconditioned grant

- **GIVEN** a `Manager` whose role grants an unconditioned `read`/`time-logs`
- **WHEN** an admin calls `GET /users/:id/abilities` for that user
- **THEN** the response includes a rule for `read`/`time-logs` with no
  condition.

#### Scenario: Non-admin cannot call the endpoint

- **GIVEN** a caller whose role does not grant `read`/`user-abilities`
- **WHEN** the caller calls `GET /users/:id/abilities` for any user
- **THEN** the system responds `403 Forbidden`.

#### Scenario: Looking up a multi-role user's resolved abilities

- **GIVEN** a target user holding both `Manager` and `Employee` roles
- **WHEN** an admin calls `GET /users/:id/abilities` for that user
- **THEN** the response includes the resolved rules from both roles' grants.
