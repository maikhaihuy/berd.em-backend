## Purpose

Guarantee that every Employee created through the API has a matching, login-capable
User account provisioned atomically, so Admins never have to separately create and
link a User by hand.

## ADDED Requirements

### Requirement: Creating an Employee provisions a matching User
The system SHALL, as part of a single atomic operation with Employee creation, ensure
a `User` exists that is linked to the new `Employee` via `Employee.userId`. When no
`User` with the Employee's phone number already exists, the system SHALL create one
with: password derived from the Employee's phone number, active status, the
`mustChangePassword` flag set, and the seeded `Employee` role assigned.

#### Scenario: Employee created with no pre-existing User for that phone number
- **WHEN** an Admin creates an Employee whose phone number does not match any existing
  `User`
- **THEN** the system creates a new `User` with that phone number, a password derived
  from the phone number, the `Employee` role, `mustChangePassword` set to true, links
  the new Employee's `userId` to it, and both records are persisted together — if
  either half cannot be created, neither is

#### Scenario: New User can log in immediately after provisioning
- **WHEN** an Employee has just been created and a User was auto-provisioned for it
- **THEN** that User can authenticate via password login using the phone number as
  username and the phone number as password

### Requirement: Employee creation rejects a colliding phone number
The system SHALL reject Employee creation with an error, and SHALL NOT create the
Employee or modify any existing User, when a `User` already exists with the same phone
number as the Employee being created.

#### Scenario: Phone number already belongs to an existing User
- **WHEN** an Admin creates an Employee whose phone number matches an already-existing
  `User`
- **THEN** the system responds with a validation error identifying the phone number
  field, creates no Employee, and leaves the existing User unchanged

### Requirement: Auto-provisioned User's role and identity are pinned to the Employee record
The system SHALL populate the auto-provisioned User's full name from the Employee's
full name, and SHALL assign it the system `Employee` role rather than any
caller-supplied role.

#### Scenario: Full name is copied from the Employee at creation time
- **WHEN** a new User is auto-provisioned for a newly created Employee
- **THEN** the User's full name matches the full name submitted for the Employee, and
  the User holds exactly the `Employee` role
