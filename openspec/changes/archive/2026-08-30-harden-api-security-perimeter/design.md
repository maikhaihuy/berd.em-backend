## Context

Three gaps in the request pipeline (`src/main.ts`, `src/common/authz.module.ts`,
`src/modules/auth/`) — see proposal.md for motivation. Relevant current state:
- `src/main.ts` sets up global prefix, `enableCors`, the validation pipe, and Swagger UI at
  `/docs`. `/docs` is the one route that serves an actual HTML page with inline
  scripts/styles (Swagger UI's bundled JS); every other route is JSON-only.
- `src/common/authz.module.ts` registers global guards via `APP_GUARD` and documents that
  registration order is execution order (`JwtAccessGuard` then `PermissionsGuard`).
- `src/modules/auth/auth.module.ts` imports bare `ThrottlerModule` (no `.forRoot()`/options) and
  the controller already carries `@Throttle(...)` overrides — but no `ThrottlerGuard` is bound
  anywhere, so none of it currently executes.
- `src/common/env.validation.ts` is a `class-validator` DTO validated at boot; there's no
  existing precedent for a list-valued env var (comma-separated string is the natural fit given
  the existing all-string-field style).

## Goals / Non-Goals

**Goals:**
- Make the existing `@Throttle` declarations on auth routes actually take effect, plus a sane
  global default for every other route.
- Lock CORS down to a configured allowlist without breaking the Swagger UI (served same-origin,
  not subject to CORS) or the frontend dashboard's cross-origin calls.
- Add baseline security headers without breaking Swagger UI's inline bundle at `/docs`.

**Non-Goals:**
- Distributed/shared rate-limit storage (e.g. Redis-backed throttler storage) — single in-memory
  store per process is acceptable for current deployment scale; revisit if/when the API runs
  behind a multi-instance load balancer.
- Per-user or per-IP allowlisting, WAF-style rules, or DDoS mitigation — this change is about
  the three specific gaps in proposal.md, not a general security overhaul.
- Changing any existing `@Throttle` limit values on auth routes.

## Decisions

**CORS allowlist via a single comma-separated env var, `CORS_ALLOWED_ORIGINS`.**
Parsed once in `main.ts` into a string array and passed as `enableCors`'s `origin` option (an
array, or a validator function for wildcard subdomain cases if ever needed — not needed today).
Follows the existing `env.validation.ts` convention of flat string fields rather than introducing
a new parsing layer; matches how the rest of the codebase already treats config (compare
`DEV_EMPLOYEE_PHONE` as a similar single-string knob). Alternative considered: a fixed
allowlist hardcoded in `main.ts` — rejected because the frontend origin differs between local
dev, staging, and prod, and hardcoding forces a code change (and redeploy) per environment.
`env.validation.ts` requires the var to be non-empty in all environments — local dev must set it
too (e.g. `http://localhost:5173`), same as every other required var in that file; there is no
implicit fallback.

**`helmet` mounted globally in `main.ts`, with `contentSecurityPolicy` disabled specifically for
the Swagger route.**
`helmet()`'s default CSP would block Swagger UI's inline `<script>`/`<style>` at `/docs`, since
CSP is applied response-wide unless scoped. Simplest correct fix: call `app.use(helmet())` with
`contentSecurityPolicy: false` in the default config passed to `SwaggerModule`-served responses,
OR mount `helmet` with CSP enabled globally except a path-scoped bypass for `/docs` and
`/docs-json`. Chosen approach: apply `helmet()` with default CSP globally, then mount a second,
CSP-disabled `helmet({ contentSecurityPolicy: false })` (or equivalent Express middleware
sequencing) scoped to the `/docs*` path registered before the global one takes effect for that
path — concretely, register the docs-scoped relaxed middleware ahead of the strict global one in
`main.ts`'s middleware order, since Express/Nest apply `app.use` middleware in registration
order and only the first matching CSP header wins. All other headers (`X-Content-Type-Options`,
`X-Frame-Options`, HSTS, etc.) stay at `helmet`'s defaults everywhere, including `/docs`.
Alternative considered: turning off CSP globally — rejected, since CSP is one of the more
valuable headers `helmet` provides and only one route needs an exception.

**`ThrottlerGuard` registered as a global `APP_GUARD` in `AuthzModule`, ordered before
`JwtAccessGuard`.**
Rate limiting should reject excessive requests before spending cycles on JWT verification or
permission resolution — cheapest check first, and it caps brute-force login attempts regardless
of whether they present a token. `ThrottlerModule.forRoot([{ ttl, limit }])` (a conservative
global default, e.g. 100 req/min) is imported once into `AuthzModule` alongside the guard
registration, replacing the bare, option-less `ThrottlerModule` import in `AuthModule` — the
existing import in `AuthModule` is removed since importing `ThrottlerModule` without `forRoot()`
provided no options and the module needs to be configured exactly once, globally, not
per-feature-module. The `@Throttle(...)` decorators already on `AuthController`'s routes need no
changes; they override the new global default per-route exactly as `@nestjs/throttler` already
supports. Alternative considered: applying `ThrottlerGuard` with `@UseGuards` only on
`AuthController` — rejected, since the proposal's "general API default" goal requires it to run
on every route, not just auth.

## Risks / Trade-offs

- **[Risk]** In-memory throttler storage resets on process restart and isn't shared across
  instances → **Mitigation**: acceptable for current single-instance deployment (see
  Non-Goals); documented here so a future move to multi-instance deployment knows to revisit.
- **[Risk]** An overly strict CORS allowlist misconfigured in an environment's `CORS_ALLOWED_ORIGINS`
  locks out the legitimate frontend → **Mitigation**: env var is validated non-empty at boot
  (fails fast/loud rather than silently defaulting to permissive), and the value is easy to
  extend (comma-separated) without a code change.
- **[Risk]** Global CSP breaking some current or future same-origin asset (beyond Swagger) →
  **Mitigation**: the API is JSON-only outside `/docs`; no other route serves HTML/inline
  scripts today, so the blast radius of a strict default CSP is limited to the one already-
  handled exception.
- **[Trade-off]** A global default throttle limit necessarily picks one number for all
  unspecified routes; some legitimately high-traffic internal routes may need their own
  `@Throttle` override later if the chosen default proves too strict — acceptable, since
  `@Throttle` overrides are already the established per-route escape hatch.
