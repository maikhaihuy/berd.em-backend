## 1. exceptionFactory: build a field-path -> messages map

- [x] 1.1 In `src/common/exception.module.ts`, replace the `errors.map(...)` array-building with a recursive walk of `ValidationError[]` (including `.children`) that accumulates into a `Record<string, string[]>`.
- [x] 1.2 Build each key as the dotted/bracketed path from root: nested object children use `parentPath.property`; children whose `property` is a numeric string (array items) use `parentPath[index]`.
- [x] 1.3 For a leaf `ValidationError` (no children, or children plus its own `constraints`), push every message from `Object.values(err.constraints)` onto that path's array — never assign/overwrite, so multiple constraint failures on one property all survive.
- [x] 1.4 Keep the `BadRequestException` body's `message` field as-is (`'Validation failed'`); only the `errors` value's shape changes (map instead of array-of-objects).

## 2. GlobalExceptionFilter: surface `errors` in the response

- [x] 2.1 In `src/common/filters/global-exception.filter.ts`, when `status === 400` and the `HttpException` body is an object, read `payload.errors` and include it as `errors` in the JSON response if it's a plain object.
- [x] 2.2 When `status === 400` and `payload.errors` is absent (or the body was a plain string), set `errors` to `{ _general: [message] }` using the same `message` already computed for the response.
- [x] 2.3 For any other status code, do not add an `errors` key — response shape stays exactly as today.
- [x] 2.4 Confirm `source`, `details`, `statusCode`, `timestamp` computation is untouched.

## 3. Tests

- [x] 3.1 Unit test the exceptionFactory (or the pipe as a whole) for: single field error, multiple fields, multiple errors on the same field, and a nested/array DTO producing `employee.email` and `items[0].quantity`-style keys.
- [x] 3.2 Unit test `GlobalExceptionFilter.catch` for: a 400 body already carrying `errors` (map passes through unchanged), a 400 body with only a plain string message (`errors._general` synthesized), and a non-400 status (no `errors` key added, response unchanged from current behavior).
- [x] 3.3 Add/extend an e2e spec hitting a real validated route (pick one existing DTO with multiple validated fields) to assert the response contains both `message` and `errors`, with the expected field keys.
- [x] 3.4 Add/extend an e2e spec for a successful request on that same route to assert the response is unaffected (no `errors` key, unchanged payload shape).
- [x] 3.5 Run `pnpm test` and `pnpm test:e2e` and confirm no unrelated suite regresses (existing tests asserting on the old `{ field, errors }[]` shape, if any, should be updated — check `global-exception.filter.spec.ts` / `exception.module` specs first). `pnpm test`: 103/103 pass. `pnpm test:e2e`: new/extended specs pass; `branch-schedule-config.e2e-spec.ts` and `payroll-crud.e2e-spec.ts` fail on unrelated tests with pre-existing 403s (confirmed reproducible by stashing this change and re-running — same failures occur, caused by the local `settings` admin seed lacking permissions those suites expect, not by this change).

## 4. Verification

- [x] 4.1 Manually hit one validated endpoint via curl/Swagger with an invalid body and confirm the JSON matches the spec (`message` + `errors` map). Verified via curl against `POST /branches` with an invalid body.
- [x] 4.2 Manually trigger one existing business-rule `BadRequestException` (e.g. an out-of-order checkout) and confirm it now returns `errors._general` with the same message text as before, same status code. Verified via curl against `POST /auth/dev/login` (unmodified `BadRequestException('INVALID_DEV_LOGIN_IDENTIFIER')` throw site) — returns 400 with `errors._general: ["INVALID_DEV_LOGIN_IDENTIFIER"]`.
- [x] 4.3 `pnpm lint` clean. Clean for every file touched by this change; the full-repo `pnpm lint` run has pre-existing errors in unrelated files (`auth.controller.ts`, several `*.mapper.ts`, `task.service.spec.ts`) not modified here.
