## Why

Cross-repo dependency check: the frontend's `build-profile-tab` proposal (Cá nhân — view/edit own
personal info) needs the backend to let an Employee update their own record. Checked against
current backend code:

- Employee role already has an unconditioned `read:employees` grant (`prisma/seed.ts:374`), and
  `GET /employees/:id` only requires `read:employees` — so an employee can already fetch their
  own record. The read side is fine.
- Employee has **no** `update:employees` grant anywhere in `employeeGrants`
  (`prisma/seed.ts:372-417`), while `PATCH /employees/:id` requires `update:employees`
  (`employee.controller.ts:86`). Today, self-editing contact info from the dashboard would just
  403.
- Even if a scoped grant is added, `UpdateEmployeeDto` isn't field-restricted per role today —
  the same DTO an Admin uses to edit role/branch/hourly-rate would also accept those fields from
  a self-service caller unless explicitly blocked. Granting `update:employees` broadly (even
  `$self`-scoped) without a field restriction would let an employee edit their own role, branch
  assignment, or pay rate — a real privilege-escalation risk, not a hypothetical one.

**Corrected 2026-09-04**: this proposal's first bullet below (a `$self`-scoped `update:employees`
grant) is superseded, not just "recommended against." `PermissionsGuard` checks
`ability.can(action, subject)` per route at the type level, independent of which specific grant
or `RolePermission.condition` matched (`CLAUDE.md`) — so giving `Employee` *any* `update:employees`
grant, `$self`-scoped or not, would also pass the guard on the existing general
`PATCH /employees/:id` route, which accepts the full `UpdateEmployeeDto` (`branchIds`, `fullName`,
etc.). A row condition restricts which employee id a query can act on; it does not restrict which
fields a request body may contain. So a `$self` grant alone would let a Staff caller hit
`PATCH /employees/:id` (their own id) with `{ branchIds: [...] }` and have it succeed — exactly
the privilege-escalation risk this proposal itself flags as "not hypothetical." The dedicated
`@SkipPermissions()` route below (second bullet) achieves this proposal's actual goal without
touching `prisma/seed.ts`'s permission grants at all — see `design.md` Decisions.

## What Changes

- ~~Add a `$self`-scoped `update:employees` grant to the Employee role in `prisma/seed.ts`~~ —
  see the correction above; no seed/permission-grant change is needed.
- **Field-restrict what self-service update can touch.** Recommended approach: a separate,
  narrower DTO (e.g. `UpdateOwnEmployeeDto` with only self-editable fields — phone number, and
  whatever other contact-type fields the product actually wants editable; exclude `role`,
  `branchId`/branch assignments, `hourlyRate`, `status`) behind its own endpoint (e.g.
  `PATCH /employees/me` or `PATCH /employees/:id/self`), rather than trying to strip disallowed
  fields at validation time on the existing Admin-facing DTO/endpoint. This is a real design
  decision (which fields are actually self-editable) — confirm with product/whoever owns the
  employee data model before implementing, don't assume the field list unilaterally.

## Capabilities

### New Capabilities
- `employee-self-profile-update`: an Employee can update a defined, safe subset of their own
  record without needing Admin/Manager involvement, without being able to touch role/branch/rate/
  status fields.

## Impact

`prisma/seed.ts`, `src/modules/employees/employee.controller.ts`,
`src/modules/employees/employee.service.ts`, a new self-service DTO
(`src/modules/employees/dto/update-own-employee.dto.ts` or similar).

**Recommend a short `design.md`** — the exact self-editable field list is a product decision, not
an implementation detail.
