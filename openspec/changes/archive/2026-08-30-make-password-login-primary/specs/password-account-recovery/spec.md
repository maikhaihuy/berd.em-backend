## Purpose

Let an Admin/Owner provision a User with a working initial password, and let a User
who forgets their password recover access through a token-based reset flow, without
falling back to direct database edits.

## ADDED Requirements

### Requirement: Admin can set an initial password when creating a User
The system SHALL accept an optional `password` field on `POST /api/users` (User
creation). When provided, the system SHALL hash it before persisting and SHALL NOT
return the plaintext or hash in any response.

#### Scenario: Admin creates a User with an initial password
- **WHEN** an Admin submits `POST /api/users` with a `password` field alongside the
  other required fields
- **THEN** the system creates the `User` with a hashed password stored, and that User
  can immediately log in via `POST /api/auth/login` using the submitted password

#### Scenario: User created without a password
- **WHEN** an Admin submits `POST /api/users` with no `password` field
- **THEN** the system creates the `User` with no password set, and password login for
  that User is rejected until a password is set via update or reset

### Requirement: Admin can set or change a User's password on update
The system SHALL accept an optional `password` field on the User update endpoint. When
provided, the system SHALL hash it before persisting, replacing any existing password.

#### Scenario: Admin sets a password for an existing passwordless User
- **WHEN** an Admin submits an update to a `User` that currently has no password,
  including a `password` field
- **THEN** the system hashes and stores the new password, and the User can now log in
  via `POST /api/auth/login`

### Requirement: User can request a password reset by username
The system SHALL accept `POST /api/auth/forgot-password` with a username (phone
number) and, for any matching User, SHALL issue a single-use, time-limited password
reset token without revealing whether the username exists.

#### Scenario: Reset requested for an existing User
- **WHEN** a User submits `POST /api/auth/forgot-password` with a phone number that
  matches an existing `User`
- **THEN** the system generates and stores a hashed reset token scoped to that User,
  with an expiry, and responds `200 OK`

#### Scenario: Reset requested for a non-existent username
- **WHEN** a caller submits `POST /api/auth/forgot-password` with a phone number that
  does not match any `User`
- **THEN** the system responds `200 OK` without creating a token and without
  indicating that the username was not found

#### Scenario: Password reset requests are rate limited
- **WHEN** a caller submits more than the configured limit of
  `POST /api/auth/forgot-password` requests within the configured window
- **THEN** the system responds `429 Too Many Requests` for the excess attempts

### Requirement: Admin can generate a reset token on a User's behalf
Because the system has no email/SMS channel to deliver a self-service reset token to a
User automatically, the system SHALL let an authorized Admin generate a password reset
token for a specific User and receive the raw token value in the response, so the
Admin can relay it to the User out of band (e.g. by phone).

#### Scenario: Admin generates a reset token for a User
- **WHEN** an authorized Admin requests a password reset token for a specific `User`
- **THEN** the system generates and stores a hashed reset token scoped to that User,
  with an expiry, and returns the raw token value in the response to the Admin

#### Scenario: Non-admin cannot generate a reset token for another User
- **WHEN** a caller without the required permission requests a password reset token for
  a `User`
- **THEN** the system responds `403 Forbidden` and does not create a token

### Requirement: User can complete a password reset with a valid token
The system SHALL accept `POST /api/auth/reset-password` with a reset token and a new
password, SHALL validate the token against the specific token submitted (not merely
"any unexpired token"), SHALL reject an expired or already-used token, and on success
SHALL replace the User's password and invalidate the token.

#### Scenario: Reset completes with a valid, unexpired token
- **WHEN** a User submits `POST /api/auth/reset-password` with a token that is
  unexpired, unused, and matches a stored reset token, along with a new password
- **THEN** the system hashes and stores the new password, invalidates the token so it
  cannot be reused, and the User can log in with the new password

#### Scenario: Reset rejected for an expired token
- **WHEN** a User submits `POST /api/auth/reset-password` with a token whose stored
  `expiresAt` has passed
- **THEN** the system responds with an error and does not change the password

#### Scenario: Reset rejected for a token that does not match the submitted value
- **GIVEN** more than one outstanding, unexpired reset token exists across different
  Users
- **WHEN** a User submits `POST /api/auth/reset-password` with a token value
- **THEN** the system validates against the specific token submitted and never
  matches against a different, unrelated unexpired token

#### Scenario: Password reset completions are rate limited
- **WHEN** a caller submits more than the configured limit of
  `POST /api/auth/reset-password` requests within the configured window
- **THEN** the system responds `429 Too Many Requests` for the excess attempts
