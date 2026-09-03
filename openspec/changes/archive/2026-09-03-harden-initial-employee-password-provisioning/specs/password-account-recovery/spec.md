## ADDED Requirements

### Requirement: Admin can re-issue a one-time credential for an unclaimed or expired User
The system SHALL let an authorized Admin re-issue a fresh one-time credential for a
specific User, overwriting the stored password, resetting `mustChangePassword` to true
with a new expiry, and returning the plaintext credential in the response so the Admin
can relay it to the User out of band. This exists because an unclaimed auto-provisioned
account's original one-time credential is never retrievable after its initial response.

#### Scenario: Admin re-issues a credential for a User whose original credential expired
- **GIVEN** a User with `mustChangePassword` set to true and an expired credential
- **WHEN** an authorized Admin requests a credential re-issue for that User
- **THEN** the system generates a new random one-time password, stores it hashed,
  resets the password-change-required expiry to a fresh window, and returns the
  plaintext credential in the response to the Admin

#### Scenario: Admin re-issues a credential for a User who never logged in
- **GIVEN** a User with `mustChangePassword` still set to true and an unexpired
  credential that was lost before being relayed to the employee
- **WHEN** an authorized Admin requests a credential re-issue for that User
- **THEN** the system replaces the existing credential with a newly generated one,
  invalidating the previous credential, and returns the new plaintext credential

#### Scenario: Non-admin cannot re-issue a credential for another User
- **WHEN** a caller without the required permission requests a credential re-issue for
  a `User`
- **THEN** the system responds `403 Forbidden` and does not change the User's password

#### Scenario: Credential re-issue is audit logged
- **WHEN** an authorized Admin re-issues a one-time credential for a User
- **THEN** the system records an audit log entry for the mutation on the `users`
  subject, without including the plaintext or hashed credential in the logged payload
