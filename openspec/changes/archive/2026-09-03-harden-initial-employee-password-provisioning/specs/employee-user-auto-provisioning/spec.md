## MODIFIED Requirements

### Requirement: Creating an Employee provisions a matching User
The system SHALL, as part of a single atomic operation with Employee creation, ensure
a `User` exists that is linked to the new `Employee` via `Employee.userId`. When no
`User` with the Employee's phone number already exists, the system SHALL create one
with: a randomly generated one-time password (not derived from the Employee's phone
number or any other value the caller supplied), active status, the `mustChangePassword`
flag set with a bounded expiry, and the seeded `Employee` role assigned. The system
SHALL return the plaintext one-time password exactly once, in the response to the
triggering `POST /employees` call, and SHALL NOT persist it in plaintext or return it
from any other request.

#### Scenario: Employee created with no pre-existing User for that phone number
- **WHEN** an Admin creates an Employee whose phone number does not match any existing
  `User`
- **THEN** the system creates a new `User` with that phone number, a randomly generated
  one-time password (hashed at rest), the `Employee` role, `mustChangePassword` set to
  true with an expiry timestamp, links the new Employee's `userId` to it, and both
  records are persisted together — if either half cannot be created, neither is

#### Scenario: New User can log in immediately after provisioning using the returned credential
- **WHEN** an Employee has just been created and a User was auto-provisioned for it
- **THEN** the `POST /employees` response includes the plaintext one-time password, and
  that User can authenticate via password login using the phone number as username and
  the returned one-time password as password

#### Scenario: The one-time password is not derivable from the Employee's submitted data
- **WHEN** a User is auto-provisioned during Employee creation
- **THEN** the generated password is not equal to, and is not deterministically derivable
  from, the Employee's phone number, full name, or any other field submitted in the
  create request

#### Scenario: The one-time password is never returned again after the initial response
- **GIVEN** a User was auto-provisioned with a one-time password during Employee creation
- **WHEN** the Employee or User is subsequently retrieved via any `GET` endpoint
- **THEN** the response does not include the plaintext password or its hash
