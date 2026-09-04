## Context

`EmployeesController`'s existing `PATCH /employees/:id` is gated by
`@RequirePermissions({ action: 'update', subject: 'employees' })`. `PermissionsGuard` checks
`ability.can(action, subject)` per route at the type level — it passes or fails for the whole
route based on whether the caller holds *any* grant of that `(action, subject)` pair, independent
of which grant matched or what `RolePermission.condition` it carries (`CLAUDE.md`). The seeded
`Employee` role's only grant of the `employees` subject today is `{ actions: ['read'] }`
(`prisma/seed.ts`) — no `update` action at all — so every Staff-role caller 403s on this route
unconditionally, including on their own record. `read:employees` is unconditioned, so
`GET /employees/:id` already works for an employee reading their own record — the proposal's read
side needs no change.

The proposal's original first bullet — add a `$self`-scoped `update:employees` grant to `Employee`
— is corrected in `proposal.md` (see the 2026-09-04 note): because the guard's check is type-level,
that grant would also pass `PermissionsGuard` on the *existing* `PATCH /employees/:id` route, which
accepts the full `UpdateEmployeeDto`. A row-scoping condition restricts which employee id a query
targets; CASL in this codebase has no concept of restricting which *fields* a request body may
carry. So a `$self` grant alone reopens exactly the privilege-escalation risk the proposal warns
about (an employee setting their own `branchIds`/role-adjacent fields via the general endpoint).
Closing that would additionally require an instance-level CASL check inside
`EmployeesService.update()` (which does no such check today, unlike `findAll`/`findOne`'s
`accessibleWhere`) — real new plumbing for a benefit the dedicated-endpoint shape below gets for
free.

A dedicated route sidesteps this entirely: the target row is derived from the caller's JWT, never
a client-supplied `:id`, so there's no row-scoping to encode in CASL at all; and a narrowly-typed
DTO gets field restriction "for free" from the global `ValidationPipe({ whitelist: true,
forbidNonWhitelisted: true })` already registered in `src/common/exception.module.ts` — any field
outside the DTO's declared properties is a `400`, not a silent drop, satisfying "don't just trust
the frontend to withhold them." This also matches the codebase's existing convention for
self-service actions: `POST /auth/change-password`, `POST /auth/logout-all`, and
`GET /me/abilities` are all `@SkipPermissions()` routes that resolve their target from the
caller's own JWT rather than a permission grant.

Secondary question resolved by inspection, not a fix needed: `Employee.email`/`Employee.address`
are real, unconstrained `String?` columns (`prisma/schema.prisma`), and
`EmployeesService.update()`'s `{ ...employeeData, updatedBy, employeeBranches: ... }` already
spreads them straight through to `prisma.employee.update()`; `EmployeeMapper.mapBase()` reads them
back on the response side. No ORM mapping or serialization gap exists.

## Goals / Non-Goals

**Goals:**
- Let a User with a linked `Employee` update their own `phoneNumber`/`email`/`address` via a
  dedicated `PATCH /employees/me` route, with no dependency on holding `update:employees`.
- Guarantee the write can only ever target the caller's own `Employee` row (resolved from
  `AuthenticatedUserDto.employeeId`, never a request parameter) — never role, branch assignment,
  hourly rate, or status.
- Guarantee any field outside the whitelist in the request body is rejected (`400`) before any
  write, not silently dropped.
- Leave the existing admin/manager `PATCH /employees/:id` path (permission, DTO, service call)
  completely unchanged, and make no change to `prisma/seed.ts`'s permission grants.

**Non-Goals:**
- No change to the CASL/permission model — no new `update:employees` grant for `Employee`, no new
  `$self`-on-own-id resolver case, no instance-level check added to `EmployeesService.update()`.
  The dedicated-route shape makes all of that unnecessary.
- No new audit-log call — `employees` is not in the currently-audited-subjects list
  (`CLAUDE.md`'s Audit log convention), and the existing `PATCH /employees/:id` doesn't audit-log
  either; adding audit logging to `employees` generally is a separate, broader decision.
- No self-service read endpoint — out of scope; `GET /employees/:id` already works for an
  employee's own id via the existing unconditioned `read:employees` grant.
- No change to which fields are self-editable beyond `phoneNumber`/`email`/`address` — the
  frontend's confirmed field list for this feature (per the request that prompted this change);
  adding more later (e.g. `avatar`) is a follow-up if requested.

## Decisions

**Dedicated `PATCH /employees/me`, `@SkipPermissions()`, over any `update:employees` grant
shape.** See Context — the type-level guard and CASL's lack of any field-level concept make every
grant-based shape (scoped or not) either unsafe (reopens the general endpoint) or require new
instance-level enforcement plumbing for no benefit over a route that never needs a grant at all.

**Route ordering: declare `@Patch('me')` before the existing `@Patch(':id')`.** Nest/Express match
routes in declaration order; a literal `me` path segment would otherwise be swallowed by the `:id`
wildcard (calling `update('me', ...)`, converting to `NaN`). This is a two-line reordering in
`EmployeesController`, not a routing redesign.

**New `UpdateMyEmployeeProfileDto`, not a `Partial`/`Pick` of `UpdateEmployeeDto`.** A standalone
class keeps the property whitelist explicit and self-contained (matches how `UpdateEmployeeDto`
itself is a plain hand-written class, not derived via mapped-type utilities elsewhere in this
codebase) and avoids a future field added to `UpdateEmployeeDto` leaking onto the self-service
surface by accident through a shared base type.

**Reuse `EmployeesService.update()` rather than a new service method.** Passing a DTO with only
`phoneNumber`/`email`/`address` set (never `branchIds`) into the existing method already exercises
its handled paths correctly: the duplicate-phone check, the `branchIds ? {...} : undefined` branch
(no branch resync when absent), and the `P2025 → NotFoundException` mapping. A caller resolved
from their own JWT is always a real Employee id, so the not-found path is unreachable in practice
but harmless.

**Resolve the target employee id from `AuthenticatedUserDto.employeeId`, reject with 403 if
absent.** Mirrors `TasksService.getEmployeeIdForUser`'s existing convention (`ForbiddenException`)
for "authenticated User with no linked Employee" — an Admin-only account calling this route has no
self to update.

## Risks / Trade-offs

- **[Risk]** A future edit to `UpdateEmployeeDto` (e.g. a new admin field) has no automatic link to
  `UpdateMyEmployeeProfileDto`, so reviewers must remember the two are intentionally separate.
  → Mitigation: a doc comment on `UpdateMyEmployeeProfileDto` pointing at this decision.
- **[Trade-off]** Duplicate-phone-number validation in `EmployeesService.update()` is shared
  between the admin and self-service paths, so a Staff member changing their own phone to one
  already in use gets the same `FieldValidationException` shape an admin would — correct behavior
  either way, since phone numbers are globally unique on `Employee`.

## Migration Plan

Additive only — a new route and a new DTO, no schema change, no `prisma/seed.ts` change, no data
migration. Nothing to roll back beyond reverting the controller/DTO addition.
