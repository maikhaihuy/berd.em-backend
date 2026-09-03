## ADDED Requirements

### Requirement: A flagged User's one-time credential expires after a bounded window
The system SHALL track an expiry timestamp alongside the password-change-required flag,
set whenever a one-time credential is issued (initial Employee-triggered provisioning,
or an Admin-initiated re-issue). While the flag is set and the expiry timestamp is in
the past, the system SHALL reject password login for that User with a distinct,
actionable error rather than treating the stored password as still valid. The system
SHALL clear the expiry timestamp whenever the password-change-required flag is cleared.

#### Scenario: Login rejected once the one-time credential has expired
- **GIVEN** a User with `mustChangePassword` set to true and an expiry timestamp in the
  past
- **WHEN** that User submits `POST /auth/login` with the phone number and any password,
  including the correct one-time credential
- **THEN** the system rejects the login with a distinct error directing the caller to
  request a re-issued credential from an Admin, rather than the generic invalid-credentials
  error

#### Scenario: Login succeeds with the one-time credential before expiry
- **GIVEN** a User with `mustChangePassword` set to true and an expiry timestamp in the
  future
- **WHEN** that User submits `POST /auth/login` with the phone number and the correct
  one-time credential
- **THEN** the system authenticates normally, subject to the existing forced-password-change
  route allowlist

#### Scenario: Expiry is cleared when the password-change-required flag is cleared
- **WHEN** a User successfully completes `POST /auth/change-password` while the
  password-change-required flag is set
- **THEN** the system clears both the password-change-required flag and its associated
  expiry timestamp, and subsequent logins are not subject to the expiry check
