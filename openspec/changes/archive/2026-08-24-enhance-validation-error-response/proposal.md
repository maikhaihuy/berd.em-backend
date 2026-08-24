## Why

When a request fails validation, the backend currently throws away the per-field detail it already computes. `ValidationPipe`'s `exceptionFactory` (`src/common/exception.module.ts`) builds a `field`/`errors` breakdown from class-validator, but `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`) only ever reads `payload.message`, `payload.source`, and `payload.details` off the exception body — so every client sees is a flat `"Validation failed"` string. The frontend has no way to attach an error to the right input, and business-rule failures thrown as plain `BadRequestException('...')` (e.g. `sub-shift-template.service.ts:129` `'Start time must be before end time'`) are equally opaque. This change makes the field-level detail actually reach the client, in a shape the frontend can key off directly (`errors[fieldName]`), without inventing a second validation mechanism.

## What Changes

- Change the `ValidationPipe` `exceptionFactory` in `src/common/exception.module.ts` to build `errors` as a `Record<string, string[]>` keyed by property path, instead of an array of `{ field, errors }` objects. Multiple constraint failures on the same field continue to aggregate into that field's array (class-validator already merges same-field constraints; the array shape now survives to the client).
- Walk `ValidationError.children` recursively so nested DTO properties and `@ValidateNested({ each: true })` array items produce dotted/bracketed paths (`employee.email`, `items[0].quantity`) instead of being flattened or dropped.
- Change `GlobalExceptionFilter` to read `payload.errors` off the exception body when present and include it in the JSON response. When a `BadRequestException` (400) carries no structured `errors` map (e.g. today's plain-string business-rule throws), fall back to `errors: { _general: [message] }` so field-scoped and general validation failures reach the client through the same key. Non-400 responses (401/403/404/409/500) are unchanged — no `errors` key is added.
- No change to `message`'s existing content/wording, HTTP status codes, `source`/`details` behavior, or any validation rule/business logic. `success` is intentionally **not** added to the envelope — no response in this codebase carries that field today (`TransformInterceptor` exists but isn't wired up), and the existing `{ statusCode, message, source, details, timestamp }` shape already signals failure via `statusCode`; adding a lone boolean elsewhere would be a bigger convention change than this task calls for.

## Capabilities

### New Capabilities
- `validation-error-response`: field-level and general validation error detail in the HTTP error response body, covering the `ValidationPipe` → `GlobalExceptionFilter` path.

### Modified Capabilities
(none — no existing spec in `openspec/specs/` governs error-response shape)

## Impact

- **Code**: `src/common/exception.module.ts` (exceptionFactory), `src/common/filters/global-exception.filter.ts` (response assembly). No controller, service, or DTO changes.
- **API contract**: additive only. Existing consumers reading `message`/`statusCode` are unaffected; `errors` is a new optional key on error responses only (never present on 2xx responses).
- **Tests**: new/updated specs for `GlobalExceptionFilter` and the `ValidationPipe` exceptionFactory (unit), plus e2e coverage hitting a real validated route to check the JSON shape end-to-end.
