## MODIFIED Requirements

### Requirement: A flagged User is restricted to an auth-only route allowlist
The system SHALL track, per User, whether they are required to change their password
before doing anything else. While that flag is set, the system SHALL reject any
authenticated request to a route outside a small allowlist (changing password, and
session/token management: logout, logout-device, logout-all, refresh) with `403
Forbidden` and a response body carrying `details.code` equal to the literal string
`"PASSWORD_CHANGE_REQUIRED"`, distinguishable from an ordinary permission-denial
response (which carries no such `details.code`).

#### Scenario: Flagged User attempts an unrelated authenticated request
- **WHEN** a User with the password-change flag set makes an authenticated request to
  a route other than change-password, logout, logout-device, logout-all, or refresh
- **THEN** the system responds `403 Forbidden` with a response body whose
  `details.code` field equals `"PASSWORD_CHANGE_REQUIRED"`, and does not perform the
  requested action

#### Scenario: Flagged User can still manage their own session
- **WHEN** a User with the password-change flag set calls logout, logout-device,
  logout-all, or refresh
- **THEN** the system processes the request normally

#### Scenario: Flagged User can call change-password despite the flag
- **GIVEN** a User with the password-change flag set
- **WHEN** that User calls `POST /api/auth/change-password` with their correct current
  password and a new password
- **THEN** the system does not reject the request on account of the flag — it is
  processed the same as it would be for an unflagged User, since this route is the
  flagged User's only way to clear the flag
