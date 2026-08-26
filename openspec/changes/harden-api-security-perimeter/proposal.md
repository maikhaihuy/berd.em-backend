_Priority: low_

## Why
Two small production-readiness gaps: CORS currently reflects any request origin while allowing
credentials (`app.enableCors({ origin: true, credentials: true })` in `src/main.ts`), and
there's no rate limiting or `helmet` on public, unauthenticated endpoints (`/auth/login`,
`/auth/dev-login`, `/auth/zalo-login`). Neither is exploitable in isolation today, but both are
standard hardening steps worth closing.

## What Changes
- Replace the reflect-any-origin CORS config with an explicit allowlist read from env config
  (frontend origin(s), Zalo Mini App webview origin if applicable).
- Add `helmet` with sane defaults.
- Add `@nestjs/throttler` (or equivalent) with stricter limits on the three public auth
  endpoints than the general API default.

## Capabilities
(none — cross-cutting hardening)

## Impact
`src/main.ts`, `package.json`, new/updated env config keys,
`src/modules/auth/*.controller.ts` (throttle decorators).
