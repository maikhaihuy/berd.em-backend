# Authentication Specification

## Purpose

Define how a User authenticates to the StaffHub web dashboard: password login is the
primary path for Admin, Manager, and Staff, with Zalo login retained as a secondary,
optional path used by the separate Zalo Mini App.

## Requirements

### Requirement: Password login is the primary authentication path
The system SHALL authenticate a User via `POST /api/auth/login` using a phone-number
username and password, and this path SHALL work end-to-end for any `User` that has a
password set — without requiring a Zalo identity, a Zalo access token, or any other
external identity provider.

#### Scenario: User logs in with phone number and password
- **WHEN** a User submits `POST /api/auth/login` with their phone number as `username`
  and their correct password
- **THEN** the system responds `200 OK` with an access/refresh token pair, the same
  shape returned by the other login endpoints

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

### Requirement: Zalo login remains available as a secondary path
The system SHALL continue to support `POST /api/auth/login/zalo` as a valid,
independent way to authenticate an existing `User` by a verified Zalo access token
matched to a pre-registered phone number, unaffected by whether that User also has a
password set.

#### Scenario: Existing User logs in via Zalo without a password set
- **GIVEN** a `User` with no password set but a phone number already registered in
  the system
- **WHEN** that User authenticates via `POST /api/auth/login/zalo` with a valid Zalo
  access token and matching phone number
- **THEN** the system responds `200 OK` with an access/refresh token pair, the same as
  today's Zalo login behavior

### Requirement: Refresh and logout are unaffected by login method
The system SHALL issue refresh tokens uniformly regardless of which login endpoint
produced the session, and SHALL accept `POST /api/auth/refresh`, `POST /api/auth/logout`,
`POST /api/auth/logout-device`, and `POST /api/auth/logout-all` for any active session
without regard to whether it originated from password, Zalo, or dev login.

#### Scenario: Session from password login can be refreshed and revoked
- **GIVEN** an access/refresh token pair obtained via `POST /api/auth/login`
- **WHEN** the caller submits `POST /api/auth/refresh` with the refresh token, then
  later `POST /api/auth/logout`
- **THEN** both requests succeed exactly as they would for a session obtained via
  `POST /api/auth/login/zalo`
