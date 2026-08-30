## 1. CORS allowlist

- [x] 1.1 Add `CORS_ALLOWED_ORIGINS` (comma-separated string) to `src/common/env.validation.ts`
      as a required `@IsString() @IsNotEmpty()` field, following the file's existing convention.
- [x] 1.2 Add `CORS_ALLOWED_ORIGINS` with a placeholder value to `.env.example`.
- [x] 1.3 In `src/main.ts`, parse `CORS_ALLOWED_ORIGINS` into a string array and replace
      `app.enableCors({ origin: true, credentials: true })` with
      `app.enableCors({ origin: <parsed array>, credentials: true })`.
- [x] 1.4 Set the local dev `.env`'s `CORS_ALLOWED_ORIGINS` to the frontend dev origin(s) so
      `pnpm run start:dev` keeps working against `staffhub-frontend`.

## 2. Security response headers

- [x] 2.1 Add `helmet` to `package.json` dependencies.
- [x] 2.2 In `src/main.ts`, mount a CSP-disabled `helmet({ contentSecurityPolicy: false })`
      scoped ahead of the global one for the `/docs` and `/docs-json` (or equivalent Swagger)
      paths, then mount `helmet()` with default config globally, in that registration order.
- [x] 2.3 Verify Swagger UI at `/docs` still loads (no CSP console errors) and a JSON route
      response carries `X-Content-Type-Options`, `X-Frame-Options`, and
      `Strict-Transport-Security` headers.

## 3. Enforced rate limiting

- [x] 3.1 In `src/common/authz.module.ts`, import `ThrottlerModule.forRoot([{ ttl, limit }])`
      with a conservative global default (e.g. 100 requests/min) and add
      `{ provide: APP_GUARD, useClass: ThrottlerGuard }` ordered *before* the existing
      `JwtAccessGuard`/`PermissionsGuard` entries, updating the module's doc comment to describe
      the new execution order.
- [x] 3.2 Remove the now-redundant bare `ThrottlerModule` import from
      `src/modules/auth/auth.module.ts` (options are now provided once, globally, in
      `AuthzModule`).
- [x] 3.3 Confirm the existing `@Throttle(...)` decorators on `AuthController`
      (`/auth/login`, `/auth/dev/login`, `/auth/login/zalo`, `/auth/forgot-password`,
      `/auth/reset-password`) still compile and override the new global default as expected.

## 4. Tests

- [x] 4.1 Add/update a `main.ts`-level or e2e test asserting a request from a non-allowlisted
      `Origin` does not receive `Access-Control-Allow-Origin` for that origin, and an allowlisted
      one does.
- [x] 4.2 Add an e2e test asserting a JSON route response carries the expected `helmet` security
      headers.
- [x] 4.3 Add an e2e test asserting repeated requests past a public auth endpoint's throttle
      limit (e.g. hitting `/auth/login` more than its configured limit within the window) receive
      `429 Too Many Requests`.
- [x] 4.4 Run `pnpm test` and `pnpm test:e2e` and fix any regressions surfaced by the new global
      guard/middleware (e.g. existing e2e specs that fire enough requests to now trip the new
      default throttle limit).

## 5. Docs

- [x] 5.1 Update `CLAUDE.md` and `AGENTS.md`'s auth/environment-variable sections to mention
      `CORS_ALLOWED_ORIGINS` and that `ThrottlerGuard` is now globally active (the "All three
      routes are `@Throttle`d like `/auth/login`" line currently undersells this — throttling
      was previously declared but inert).
