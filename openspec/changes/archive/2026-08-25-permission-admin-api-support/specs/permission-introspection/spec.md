## ADDED Requirements

### Requirement: Self-scoped effective-abilities lookup
The system SHALL expose `GET /me/abilities` to any authenticated user
(`@SkipPermissions()` — no specific `(action, subject)` grant required
beyond being logged in, the same posture as other self-service routes like
`/auth/active-sessions`), which builds an `Ability` via
`CaslAbilityFactory.createForUser()` from the caller's own role and
role-permission grants, and returns the resulting granted rules as
`{ action, subject, condition }[]` — reflecting what the caller would
actually be authorized for, not the raw `RolePermission` rows.

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

### Requirement: Admin-scoped effective-abilities lookup for a target user
The system SHALL expose `GET /users/:id/abilities`, gated by
`RequirePermissions({ action: 'read', subject: 'user-abilities' })`, which
loads the target user's role and role-permission grants (the same
`userWithRolePermissionsInclude` shape `JwtAccessStrategy` loads for the
caller), builds an `Ability` via `CaslAbilityFactory.createForUser()` using
the target user's own identity for `$self` resolution, and returns the
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

### Requirement: Both abilities endpoints report dropped rules, never 500
Both `GET /me/abilities` and `GET /users/:id/abilities` SHALL build their
target's `Ability` using the same drop-rule-and-log resolution as the live
authorization path (see the `authorization` capability's "Unresolvable or
unknown condition tokens are dropped, not thrown" requirement): a grant
whose condition can't be resolved for that target (e.g. `$self` requiring an
`employeeId` the target doesn't have) is silently excluded from the response
rather than raising an error. Neither endpoint SHALL ever respond `500` as a
result of a single unresolvable grant.

#### Scenario: Target user with an unresolvable condition is simply absent from the result
- **GIVEN** a target `User` with no linked `Employee`, whose role grants a
  permission with `condition: { "employeeId": "$self" }`, alongside another,
  unconditioned permission grant
- **WHEN** an admin calls `GET /users/:id/abilities` for that user
- **THEN** the response includes the unconditioned grant's rule but omits
  the unresolvable one — the request succeeds (`200 OK`), it does not 500.

#### Scenario: A caller with an unresolvable grant on their own abilities gets the same treatment
- **GIVEN** a `User` with no linked `Employee`, whose role grants a
  permission with `condition: { "employeeId": "$self" }`
- **WHEN** that user calls `GET /me/abilities`
- **THEN** the response omits the unresolvable rule and responds `200 OK`,
  consistent with how `GET /users/:id/abilities` handles the same case for
  an admin caller.
