## Context

See proposal.md - Why. Two pieces of code are involved end to end:

- `src/common/exception.module.ts` registers the `APP_PIPE` `ValidationPipe` whose `exceptionFactory` turns class-validator's `ValidationError[]` into a `BadRequestException` body. Today that body is `{ message: 'Validation failed', errors: [{ field, errors }] }` — an array, one entry per top-level property, with no path for nested/array properties (`err.children` is never walked).
- `src/common/filters/global-exception.filter.ts` (`@Catch()`, registered after `PrismaExceptionFilter`) is the single place that turns *every* uncaught exception in the app into the final JSON response. It currently reads only `payload.message`, `payload.source`, `payload.details` off an `HttpException`'s body and emits `{ statusCode, message, source, details, timestamp }` — so the `errors` array built above is silently discarded before it reaches the client. This is the actual defect: per-field detail is already computed and then thrown away one layer up.

Both class-validator DTO failures and hand-written business-rule checks (`throw new BadRequestException('Start time must be before end time')` in several services) go through this same filter, so fixing the filter fixes both in one place.

## Goals / Non-Goals

**Goals:**
- Make `GlobalExceptionFilter` surface an `errors: Record<string, string[]>` map on validation-shaped 400 responses, sourced from the `ValidationPipe` exceptionFactory when present, or synthesized from the exception message when not.
- Make the exceptionFactory build full property paths (dot for nested objects, `[index]` for array items) by walking `ValidationError.children`, and keep aggregating multiple constraint failures per property into one array (class-validator already merges same-property constraints via `err.constraints`; only the surrounding shape changes).
- Keep everything else — validation rules, business logic, HTTP status codes, `message` wording, non-400 response shapes — untouched.

**Non-Goals:**
- Reshaping the success-response envelope, or wiring up `TransformInterceptor`. Out of scope and unrelated to error handling.
- Adding a top-level `success` boolean. No response in this codebase carries that field today; introducing it would be a broader convention change than "fix the error body," and `statusCode` already tells the client success vs. failure. Flagged in the proposal as an intentional deviation from the task's example JSON.
- Changing Prisma-originated error messages/status codes (`PrismaExceptionFilter` output). Those responses pass through `GlobalExceptionFilter` unchanged except that a 400-status Prisma error (e.g. P2003/P2014/P2000) will now also get the same `errors._general` fallback as any other 400 — consistent with treating "any 400" as validation-shaped, not a special case.
- Retrofitting existing DTOs to use `@ValidateNested`/array validation. None currently do; the path-building logic is written generically so it's correct if/when a DTO adopts nested validation, but no existing DTO is modified by this change.

## Decisions

**1. Fix at `GlobalExceptionFilter`, not by wrapping every throw site.**
The filter is the single funnel for all HTTP exceptions app-wide (business logic already just does `throw new BadRequestException(...)`). Changing it once is a one-file fix for every current and future 400 throw, and matches "no duplicate validation mechanism" — there is still exactly one place that decides what an error response looks like.

**2. `errors` shape is `Record<string, string[]>`, not the current `{ field, errors }[]`.**
A map is what `form.setError(field, ...)` / `errors[field]` frontend code needs directly (proposal section 8); an array requires a linear scan first. This does change the *shape* of the exceptionFactory's intermediate payload, but that payload is internal (only `GlobalExceptionFilter` reads it) — no existing consumer depends on the old array shape reaching the client, since it never did (see Context).

**3. General/business-rule 400s map to `errors._general`, scoped to `statusCode === 400` only.**
Rather than inventing a rule for "is this a validation error," any `BadRequestException` is treated as validation-shaped — that already matches how the codebase uses 400 today (grep shows `BadRequestException` used exclusively for input/state validation, e.g. `sub-shift-template.service.ts`, `assignment.service.ts`). 401/403/404/409/500 are left exactly as they render today; those aren't "did my input pass validation" failures and the proposal/spec explicitly says their shape must not change.
`_general` was chosen over, e.g., omitting `errors` for non-field errors, because the spec requirement is that a client reading only `errors` never silently misses a rejection — the field name doubles as a routing key and a general-message channel needs a defined key.
Alternative considered: only add `errors._general` when the `BadRequestException` body has no `errors` key already (i.e., wasn't produced by the ValidationPipe). This is what's implemented — it's not really an alternative, it's the actual precedence rule: structured `errors` from the pipe wins; anything else 400-shaped falls back to `_general`.

**4. Path building walks `ValidationError.children` recursively inside the exceptionFactory.**
class-validator attaches nested/array-item failures as `children` on the parent `ValidationError`, each with its own `property` (the nested key, or the array index as a string) and possibly further `children`. The factory recurses, building `parentPath.child` for named children and `parentPath[index]` when a child's `property` is a numeric string, then flattens to leaf constraint messages. This lives entirely in the one function that already has access to the raw `ValidationError[]` — `GlobalExceptionFilter` never sees `ValidationError` objects, only the already-flattened `errors` map, so no second implementation of path-building is needed there.

## Risks / Trade-offs

- **[Risk]** Any existing 400 thrown with a custom object body that isn't just `{ message }` (e.g. `assignment.service.ts` checkout: `throw new BadRequestException({ message: '...', blockingTasks: [...] })`) will now also get an `errors._general` entry alongside its existing (already-dropped-today) extra keys. → **Mitigation**: `blockingTasks` and similar extra keys are already absent from the current response (`GlobalExceptionFilter` only ever forwarded `message`/`source`/`details`), so this is strictly additive, not a further regression. No consumer today reads a field that disappears.
- **[Risk]** Treating every 400 as validation-shaped could someday misfire if a future 400 is thrown for a reason that truly isn't "validation" (e.g. a rate limit). → **Mitigation**: none needed now — no such usage exists today (verified via grep); if it's added later, that code can throw a different status or attach a structured `errors` map itself to opt out of the `_general` fallback.
- **[Risk]** Deviating from the requested `success` field could surprise a frontend implementer who read the task description literally. → **Mitigation**: called out explicitly in proposal.md's "What Changes" and here, with the concrete reason (no such field exists anywhere else in the API today).

## Migration Plan

Single deploy, no data migration. The change is additive to error response bodies only:
- Roll out: merge, deploy normally — no feature flag needed since `errors` is a new key that non-updated frontend clients simply ignore.
- Rollback: revert the two files; no schema/data to unwind.
