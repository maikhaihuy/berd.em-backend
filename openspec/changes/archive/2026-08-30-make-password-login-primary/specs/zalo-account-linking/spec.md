## Purpose

Let an already-authenticated User optionally attach a Zalo identity to their account,
decoupling "which method a User logs in with" from "whether a Zalo identity is linked",
so the web dashboard can offer Zalo linking without requiring Zalo to log in.

## ADDED Requirements

### Requirement: Authenticated User can link a Zalo identity
The system SHALL accept an authenticated request to link a verified Zalo identity to
the caller's own `User` account, independent of `POST /api/auth/login/zalo`, and SHALL
NOT require the caller to have logged in via Zalo to use it.

#### Scenario: Password-authenticated User links their Zalo account
- **GIVEN** a User who is authenticated via a password-login session and has no
  `ZaloIdentity` linked
- **WHEN** that User calls the authenticated Zalo-linking endpoint with a valid Zalo
  access token
- **THEN** the system verifies the token with Zalo, creates a `ZaloIdentity` linked to
  the caller's `User`, and responds `200 OK`

#### Scenario: Linking rejected when the Zalo account is already linked elsewhere
- **GIVEN** a Zalo identity that is already linked to a different `User`
- **WHEN** the caller attempts to link that same Zalo identity to their own account
- **THEN** the system rejects the request and does not modify either User's link

#### Scenario: Linking rejected when the caller already has a linked Zalo identity
- **GIVEN** a caller whose `User` already has a `ZaloIdentity` linked
- **WHEN** the caller attempts to link a Zalo identity again
- **THEN** the system rejects the request without creating a second `ZaloIdentity` for
  that User

#### Scenario: Unauthenticated caller cannot link a Zalo identity
- **WHEN** a request to the authenticated Zalo-linking endpoint is made without a
  valid access token
- **THEN** the system responds `401 Unauthorized` and does not create a `ZaloIdentity`
