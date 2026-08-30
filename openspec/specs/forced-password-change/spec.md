# Forced Password Change Specification

## Purpose

Ensure a User issued a system-derived temporary password (e.g. auto-provisioned at
Employee creation) is forced to set their own password before using the rest of the
API, so a predictable default password is never left standing.

## Requirements

### Requirement: A flagged User is restricted to an auth-only route allowlist
The system SHALL track, per User, whether they are required to change their password
before doing anything else. While that flag is set, the system SHALL reject any
authenticated request to a route outside a small allowlist (changing password, and
session/token management: logout, logout-device, logout-all, refresh) with `403
Forbidden` and an error the caller can distinguish from an ordinary permission denial.

#### Scenario: Flagged User attempts an unrelated authenticated request
- **WHEN** a User with the password-change flag set makes an authenticated request to
  a route other than change-password, logout, logout-device, logout-all, or refresh
- **THEN** the system responds `403 Forbidden` with a distinct error code identifying
  that a password change is required, and does not perform the requested action

#### Scenario: Flagged User can still manage their own session
- **WHEN** a User with the password-change flag set calls logout, logout-device,
  logout-all, or refresh
- **THEN** the system processes the request normally

### Requirement: User can change their own password to clear the flag
The system SHALL accept an authenticated request carrying the User's current password
and a new password. On success, the system SHALL replace the stored password and clear
the password-change-required flag. The system SHALL reject the request, without
changing the password or the flag, if the submitted current password does not match
the one on file — even while the flag is set.

#### Scenario: Successful password change clears the flag
- **WHEN** an authenticated User submits their correct current password along with a
  new password
- **THEN** the system stores the new (hashed) password, clears the
  password-change-required flag, and subsequent requests from that User are no longer
  restricted to the allowlist

#### Scenario: Wrong current password is rejected even under the forced-change flag
- **WHEN** an authenticated User with the password-change flag set submits an
  incorrect current password
- **THEN** the system responds with an error, does not change the stored password, and
  leaves the flag set

### Requirement: The password-change-required flag is visible to the authenticated User
The system SHALL make the current caller's password-change-required status available
from their authenticated identity, evaluated fresh rather than cached in a way that
could go stale.

#### Scenario: Flag reflects the current database state
- **WHEN** a User's password-change-required flag is cleared while they hold an
  already-issued access token
- **THEN** a subsequent authenticated request from that User is evaluated as no longer
  requiring a password change, without needing a new token
