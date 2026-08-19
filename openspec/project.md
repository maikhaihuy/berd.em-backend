# Project Context

## Purpose

StaffHub backend (`berd.em-backend`): a REST API for employee shift
scheduling, task assignment, attendance/time tracking, and payroll for a
multi-branch business (e.g. retail/F&B branches). Employees register
availability for shifts, get assigned, check in/out, request leave with a
replacement employee, and have hours converted into payroll entries.

## Tech Stack

- **Framework**: NestJS 11 (TypeScript), Express platform
- **ORM/DB**: Prisma 6 + PostgreSQL, `Int` autoincrement primary keys, hard
  deletes (no soft-delete column)
- **Auth**: Passport (`jwt`, `local` strategies), `@nestjs/jwt`, Zalo Mini App
  OAuth as the primary login path
- **Validation**: `class-validator` / `class-transformer` via a global
  `ValidationPipe` (whitelist, transform, forbidNonWhitelisted)
- **Docs**: `@nestjs/swagger`, served at `/docs`; OpenAPI JSON/types can be
  exported via `pnpm openapi:export`
- **Observability**: `@sentry/node` for 5xx error reporting; custom
  `LoggerService`
- **Testing**: Jest for unit specs (`rootDir: src`), separate Jest config for
  `*.e2e-spec.ts` at repo root using `supertest`
- **Tooling**: pnpm, ESLint (flat config) + Prettier

Note: `@casl/ability` / `@casl/prisma` remain in `package.json` but are
**unused dead dependencies** — do not build new authorization on them (see
Authorization below).

## Architecture

### Request pipeline

Global route prefix `api`. Two guards run globally, in order:

1. `JwtAccessGuard` — passport `jwt` strategy; loads the user fresh from the
   DB on each request (not from token claims) so role/permission changes take
   effect immediately. Honors `@Public()`.
2. `PermissionsGuard` — deny-by-default authorization. Honors `@Public()` and
   `@SkipPermissions()`; every other route MUST declare
   `@RequirePermissions({ action, subject })` or the request is rejected.

Exceptions flow through `PrismaExceptionFilter` → `GlobalExceptionFilter`,
normalized to `{ statusCode, message, source, details, timestamp }`. Prisma
`P2002` (unique conflict) → 400, `P2025` (not found) → 404, handled per-service
rather than pre-checked. There is no global response-wrapping interceptor
active — API responses are returned as-is from handlers/mappers.

### Authorization model (custom RBAC, not CASL)

`Permission(action, subject)` → `RolePermission` → `Role` → `User` (one role
per user, not many-to-many). `action: 'manage'` and `subject: 'all'` act as
wildcards. A handful of privileged sub-operations are modeled as their own
dedicated actions rather than folded into `update` (e.g. `check-in`/`check-out`
on assignments, `approve`/`cancel` on leave-requests, `verify` on time-logs,
`generate` on master-shifts, `complete` on tasks) so a role can hold
self-service rights without full edit rights on the subject. See
`openspec/specs/authorization/spec.md` for the full behavioral spec.

### Auth flows

- **Zalo login** (primary): verifies a Zalo access token server-side and links
  a `ZaloIdentity` to a pre-existing `User` matched by phone number. Zalo users
  are never auto-created — the phone number must already belong to a `User`.
- **Dev login**: bypasses Zalo for local/frontend development, gated by an
  env flag + shared secret header, and hard-disabled when
  `NODE_ENV=production`.
- **Password login** exists on `User` but is being phased out in favor of
  Zalo; password-reset flows are deprecated.
- Access + refresh JWT pair; refresh tokens are persisted hashed (rotation +
  revocation, per-session `source`/`device`/`ipAddress` tracking).

### Domain model

Two-layer shift design: reusable **templates** generate dated **instances**.

```
Branch
 ├─ MasterShiftTemplate ──generates──▶ MasterShift (per workDate)
 │    └─ SubShiftTemplate ───────────▶     └─ SubShift
 │         └─ TaskTemplate ──────────▶          └─ Task ─▶ TaskCompletion
 └─ BranchScheduleConfig (per-branch scheduling rules)

Employee ──Availability (registers interest in a SubShift)
         ──Assignment (employee ↔ SubShift, optionally sourced from an Availability)
                ├─ AttendanceHistory (check-in/out/replacement/manager-adjust log)
                ├─ LeaveRequest (absence + replacement employee, approval workflow)
                └─ TimeLog ─▶ PayrollEntry ─▶ PayPeriod
```

Key business rules:
- `SubShiftType`: `MAIN` vs `SUPPORT`. `TaskType`: `SHARED_MANDATORY` /
  `SHARED_OPTIONAL` / `DEDICATED` — a `Task`/`TaskTemplate` can scope to a
  master-shift-template, sub-shift-template, master shift, or sub-shift.
  `TaskCompletion` is 1:1 with `Task`.
  `Assignment` is unique per `(employeeId, subShiftId)`; it may optionally
  reference the `Availability` it was created from.
- `Employee.userId` is nullable — an employee record can exist before it's
  linked to a login-capable `User` (e.g. onboarding before first Zalo login).
- Every mutable model carries `createdAt/createdBy/updatedAt/updatedBy`
  (`Int` user IDs) audit columns. There is no soft delete — `.delete()` is a
  real row delete.
- Pay: `TimeLog` (approved worked time, with `multiplier` for
  overtime/holiday rates) → `PayrollEntry` (1:1 with a `TimeLog`) →
  `PayPeriod` (open/closed/finalized window).

## Module structure

Each domain lives in `src/modules/<name>/` as:
`<name>.module.ts`, `<name>.service.ts` (Prisma + business logic),
`<name>.controller.ts` (HTTP, guards, Swagger), `<name>.mapper.ts` (static
class mapping Prisma models → response DTOs), `<name>.types.ts` (shared
Prisma `include`/`select` objects via `satisfies Prisma.XInclude` plus derived
`Prisma.XGetPayload` types), `dto/*.dto.ts`. New modules must be registered in
`src/app.module.ts`'s `imports` or their routes 404.

`src/modules/employees/` is the reference implementation for this pattern
(branch assignment, hourly-rate sync via `$transaction`, mapper composition
for partial includes).

## Conventions

- Import via path aliases `@modules/*` and `@common/*`, never relative
  `../../` across module boundaries.
- Permission subjects follow kebab-case matching the Prisma model's plural
  table concept (e.g. `employees`, `employee-hourly-rates`, `leave-requests`),
  and actions are verbs (`create`, `read`, `update`, `delete`, plus the
  dedicated privileged actions listed above).
- `@SkipPermissions()` is reserved for authenticated-self routes needing no
  fine-grained check (logout, active-sessions) — not a general escape hatch.
- Unit specs mock `PrismaService` per method; e2e specs boot the real
  `AppModule` and hit routes with `supertest`.

## Notes

The CASL module (`src/modules/casl/`) and `TransformInterceptor`
(`src/common/interceptors/transform.interceptor.ts`) exist in the tree but are
not wired into the app — don't extend or rely on either. `AGENTS.md` and
`CLAUDE.md` cover the same ground for different tools and are kept in sync.
`.claude/skills/` holds project-specific skills (`crud-generation`,
`database-lifecycle`, `nestjs-prisma-expert`, `schema-review`, `test-writing`)
plus the OpenSpec workflow skills (`openspec-*`); all are current with
`prisma/schema.prisma` and the actual `src/` code.
