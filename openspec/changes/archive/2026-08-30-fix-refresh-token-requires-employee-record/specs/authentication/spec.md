## MODIFIED Requirements

### Requirement: Refresh and logout are unaffected by login method
The system SHALL issue refresh tokens uniformly regardless of which login endpoint
produced the session, and SHALL accept `POST /api/auth/refresh`, `POST /api/auth/logout`,
`POST /api/auth/logout-device`, and `POST /api/auth/logout-all` for any active session
without regard to whether it originated from password, Zalo, or dev login.

Refresh SHALL also be unaffected by whether the session's `User` has a linked `Employee`
record: a `User` with no `Employee` link SHALL be able to refresh their session exactly as
freely as one with a link, with an empty branch list on the reissued access token. Refresh
SHALL still fail if the `User`'s `employee` reference is set but the referenced `Employee`
row cannot be found, since that indicates a genuine data-integrity problem rather than a
legitimately employee-less account.

#### Scenario: Session from password login can be refreshed and revoked
- **GIVEN** an access/refresh token pair obtained via `POST /api/auth/login`
- **WHEN** the caller submits `POST /api/auth/refresh` with the refresh token, then
  later `POST /api/auth/logout`
- **THEN** both requests succeed exactly as they would for a session obtained via
  `POST /api/auth/login/zalo`

#### Scenario: Refresh succeeds for a User with no linked Employee record
- **GIVEN** a `User` with no linked `Employee` record who has an access/refresh token pair
  from a successful `POST /api/auth/login`
- **WHEN** the caller submits `POST /api/auth/refresh` with the refresh token
- **THEN** the system responds `200 OK` with a new access/refresh token pair whose access
  token has an empty `branches` list, rather than failing with a not-found error

#### Scenario: Refresh still fails for a User whose linked Employee record is missing
- **GIVEN** a `User` whose `employee` reference is set to an `Employee` id that no longer
  exists (e.g. the `Employee` row was deleted out from under an active session)
- **WHEN** the caller submits `POST /api/auth/refresh` with that session's refresh token
- **THEN** the system responds with a not-found error, unchanged from today's behavior
