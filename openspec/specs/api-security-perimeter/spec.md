# Api Security Perimeter Specification

## Purpose

Defines the baseline network-perimeter protections every HTTP request to the API is subject to,
independent of authentication or authorization: which browser origins may make credentialed
requests, what security-related response headers are always present, and how aggressively
repeated requests are throttled.

## Requirements

### Requirement: CORS origin allowlist
The system SHALL only allow cross-origin browser requests with credentials from an explicit,
configured allowlist of origins. Requests from an origin not on the allowlist SHALL NOT receive
`Access-Control-Allow-Origin`/`Access-Control-Allow-Credentials` headers permitting the browser
to expose the response to script running on that origin.

#### Scenario: Allowlisted origin is granted CORS access
- **WHEN** a browser sends a request with an `Origin` header matching a configured allowed
  origin
- **THEN** the response includes `Access-Control-Allow-Origin` set to that origin and
  `Access-Control-Allow-Credentials: true`

#### Scenario: Non-allowlisted origin is denied CORS access
- **WHEN** a browser sends a request with an `Origin` header that does not match any configured
  allowed origin
- **THEN** the response does not include an `Access-Control-Allow-Origin` header matching that
  origin, so the browser blocks the calling page from reading the response

### Requirement: Baseline security response headers
The system SHALL apply a standard set of HTTP security headers (e.g. `X-Content-Type-Options`,
`X-Frame-Options`/frame-ancestors policy, `Strict-Transport-Security`) to every response it
returns, regardless of route or authentication state.

#### Scenario: Security headers present on an authenticated route
- **WHEN** any client calls an existing API route, authenticated or public
- **THEN** the response includes the configured baseline security headers

### Requirement: Content-Security-Policy is relaxed only for the Swagger UI route
The system SHALL apply a strict `Content-Security-Policy` header to every route except `/docs*`,
and SHALL omit `Content-Security-Policy` on `/docs*` so Swagger UI's inline-script bundle is not
blocked. This exception SHALL NOT weaken any other security header on `/docs*` or any header on
routes outside it.

#### Scenario: Strict CSP applied outside /docs
- **WHEN** a client calls any API route not under `/docs`
- **THEN** the response includes a strict `Content-Security-Policy` header

#### Scenario: Swagger UI is served without a blocking CSP
- **WHEN** a client requests `/docs`
- **THEN** the response has no `Content-Security-Policy` header restricting its inline scripts,
  and the page's other baseline security headers are still present

### Requirement: Enforced rate limiting on the public HTTP surface
The system SHALL enforce a default request-rate limit across the general API, and SHALL enforce
stricter, per-route limits on public unauthenticated endpoints (login, dev login, Zalo login,
forgot-password, reset-password) as already declared on those routes. Exceeding a limit SHALL
result in a rejected request rather than being silently accepted.

#### Scenario: Exceeding the per-route limit on a public auth endpoint
- **WHEN** a caller sends more requests to a rate-limited public auth endpoint (e.g.
  `/auth/login`) than that endpoint's configured limit within its time window
- **THEN** subsequent requests within the window are rejected with `429 Too Many Requests`

#### Scenario: Exceeding the general default limit on a route without a specific override
- **WHEN** a caller sends more requests to a route that has no route-specific `@Throttle`
  override than the configured default limit within its time window
- **THEN** subsequent requests within the window are rejected with `429 Too Many Requests`

#### Scenario: Requests within limits are unaffected
- **WHEN** a caller sends requests to any route at a rate within the applicable limit
- **THEN** every request is processed normally and none are rejected for rate-limiting reasons
