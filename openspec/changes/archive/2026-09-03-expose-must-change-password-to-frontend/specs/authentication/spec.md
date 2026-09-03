## MODIFIED Requirements

### Requirement: Password login is the primary authentication path
The system SHALL authenticate a User via `POST /api/auth/login` using a phone-number
username and password, and this path SHALL work end-to-end for any `User` that has a
password set — without requiring a Zalo identity, a Zalo access token, or any other
external identity provider. The issued access token SHALL carry the same set of
claims (`roles`, `branches`, `managedBranches`, `empId` where applicable,
`mustChangePassword`) as a token issued by any other login endpoint for an
equivalent `User`, sourced fresh from that `User`'s current database state.

#### Scenario: User logs in with phone number and password
- **WHEN** a User submits `POST /api/auth/login` with their phone number as `username`
  and their correct password
- **THEN** the system responds `200 OK` with an access/refresh token pair, the same
  shape returned by the other login endpoints

#### Scenario: Login token carries the User's current roles, branches, and managed branches
- **WHEN** a User with one or more roles, assigned branches, or managed branches logs
  in via `POST /api/auth/login`
- **THEN** the decoded access token's `roles`, `branches`, and `managedBranches` claims
  match that User's current database state exactly, rather than being omitted

#### Scenario: Login rejected for wrong password
- **WHEN** a User submits `POST /api/auth/login` with a phone number that exists but an
  incorrect password
- **THEN** the system responds `401 Unauthorized` and does not reveal whether the
  phone number itself is registered

#### Scenario: Login rejected for a User with no password set
- **WHEN** a User submits `POST /api/auth/login` for a phone number belonging to a
  `User` that has no password set (`password` is null)
- **THEN** the system responds with an error indicating password login is not available
  for that account, rather than a generic authentication failure

#### Scenario: Login rejected for inactive User
- **WHEN** a User submits `POST /api/auth/login` for a phone number belonging to a
  `User` whose `status` is not `ACTIVE`
- **THEN** the system responds `401 Unauthorized`

#### Scenario: Password login attempts are rate limited
- **WHEN** a caller submits more than the configured limit of `POST /api/auth/login`
  requests within the configured window
- **THEN** the system responds `429 Too Many Requests` for the excess attempts

## ADDED Requirements

### Requirement: The access token carries a mustChangePassword claim
The system SHALL include a `mustChangePassword: boolean` claim on every access token
it issues — from `POST /api/auth/login`, `POST /api/auth/login/zalo`,
`POST /api/auth/dev/login`, and `POST /api/auth/refresh` alike — reflecting the
authenticating (or refreshing) `User`'s current `mustChangePassword` value at the
moment of issuance, not a cached or stale value.

#### Scenario: A flagged User's access token decodes with mustChangePassword true
- **GIVEN** a `User` with `mustChangePassword` set to `true`
- **WHEN** that User authenticates successfully via any login endpoint
- **THEN** the returned access token decodes with a `mustChangePassword` claim equal
  to `true`

#### Scenario: An unflagged User's access token decodes with mustChangePassword false
- **GIVEN** a `User` with `mustChangePassword` set to `false`
- **WHEN** that User authenticates successfully via any login endpoint
- **THEN** the returned access token decodes with a `mustChangePassword` claim equal
  to `false`

#### Scenario: A refreshed access token reflects the User's current flag state
- **GIVEN** a `User` whose `mustChangePassword` flag changed (in either direction)
  since their last token was issued
- **WHEN** that User submits `POST /api/auth/refresh` with a valid refresh token
- **THEN** the newly issued access token's `mustChangePassword` claim reflects the
  User's current database state, not the value at original login time
