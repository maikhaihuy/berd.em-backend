_Priority: low_

## Why
Three production-readiness gaps in the API perimeter:
1. CORS currently reflects any request origin while allowing credentials
   (`app.enableCors({ origin: true, credentials: true })` in `src/main.ts`) — any website can
   make credentialed requests against the API from a browser.
2. No `helmet` (or equivalent) security response headers are set anywhere in the request
   pipeline.
3. `@nestjs/throttler` is already a dependency and `@Throttle(...)` decorators already exist on
   the public auth endpoints (`/auth/login`, `/auth/dev/login`, `/auth/login/zalo`,
   `/auth/forgot-password`, `/auth/reset-password` in `src/modules/auth/auth.controller.ts`), but
   `ThrottlerGuard` is never registered — not globally via `APP_GUARD`, not per-controller via
   `@UseGuards`. The decorators are inert today: none of these endpoints are actually
   rate-limited, despite CLAUDE.md documenting them as throttled.

None is independently exploitable today, but all three are standard hardening steps, and (3) is
effectively a latent bug (documented behavior that doesn't happen).

## What Changes
- Replace the reflect-any-origin CORS config with an explicit allowlist read from a new env var
  (comma-separated origins — frontend origin(s), Zalo Mini App webview origin if applicable),
  validated at boot by `src/common/env.validation.ts`.
- Add `helmet` with sane defaults to the global request pipeline in `src/main.ts`.
- Register `ThrottlerGuard` globally (`APP_GUARD`) with a default limit for the general API,
  so the existing `@Throttle(...)` overrides on the public auth endpoints actually take effect.

## Capabilities
- `api-security-perimeter` (new) — CORS allowlist enforcement, baseline security response
  headers, and enforced rate limiting on the public HTTP surface.

## Impact
`src/main.ts`, `src/common/env.validation.ts`, `.env.example`, `package.json` (add `helmet`),
`src/modules/auth/auth.module.ts` / `auth.controller.ts` (no behavior change to existing
`@Throttle` values, just making the guard active).
