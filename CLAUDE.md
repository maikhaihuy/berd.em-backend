# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StaffHub backend (`berd.em-backend`) is a NestJS 11 + Prisma REST API for employee shift scheduling, task assignment, time tracking, and payroll. Auth is Zalo Mini App OAuth (primary) plus a JWT access/refresh pair; authorization is a custom permission system (NOT CASL, see below).

**Stale docs warning**: `AGENTS.md` and `.github/skills/*/SKILL.md` describe an earlier version of this project (CASL guards, `WorkSlot`/`Schedule` models, UUID primary keys, soft deletes via `deletedAt`). None of that matches the current codebase — schema now uses `Int` autoincrement IDs, hard deletes, and a template→generated-instance shift model. Trust `prisma/schema.prisma` and the actual `src/` code over those docs.

## Commands

```bash
pnpm install
pnpm run start:dev        # watch mode, port from .env (PORT, default 3001)
pnpm run build
pnpm lint                 # eslint --fix
pnpm format               # prettier --write

# Tests
pnpm test                              # unit tests (Jest, rootDir=src)
pnpm test <name-fragment>              # run matching spec files, e.g. `pnpm test employee.service`
pnpm test:watch
pnpm test:cov
pnpm test:e2e                          # e2e specs under test/*.e2e-spec.ts (separate jest config: test/jest-e2e.json)

# Database (Prisma)
pnpm db:dev --name "description"       # create + apply migration in dev
pnpm db:push                           # push schema without migration
pnpm db:deploy                         # apply pending migrations (prod-style)
pnpm db:reset                          # drop, reapply all migrations, reseed
pnpm db:seed                           # run prisma/seed.ts directly
```

There is no dev Docker/DB bootstrap script — `DATABASE_URL` in `.env` must point at a reachable Postgres instance before any `db:*` command works.

## Architecture

### Path aliases
`@modules/*` → `src/modules/*`, `@common/*` → `src/common/*` (see `tsconfig.json` / jest `moduleNameMapper`). Always import via these aliases, not relative `../../`.

### Request pipeline
Global prefix `api`, Swagger UI at `/docs` (see `src/main.ts`). Two guards run globally in this order (registered in `src/common/authz.module.ts` via `APP_GUARD`):

1. `JwtAccessGuard` — authenticates via passport `jwt` strategy. Honors `@Public()`.
2. `PermissionsGuard` — authorizes. Honors `@Public()` and `@SkipPermissions()`. **Deny-by-default**: any route that isn't `@Public()` or `@SkipPermissions()` MUST declare `@RequirePermissions({ action, subject })` or every request 403s with "This route does not declare required permissions".

Decorators live in `src/common/decorators/`: `Public()`, `SkipPermissions()`, `RequirePermissions(...)`. `@SkipPermissions()` is for authenticated-self routes that need no fine-grained check (logout, active-sessions). Permission checks compare `(action, subject)` against the JWT payload's `user.permissions`, with `manage`/`all` acting as wildcards.

`ValidationPipe` (whitelist, transform, forbidNonWhitelisted) is registered as `APP_PIPE` in `src/common/exception.module.ts` with a custom `exceptionFactory` that reshapes class-validator errors into `{ message, errors: [{ field, errors }] }`. `main.ts` also constructs its own `ValidationPipe` via `app.useGlobalPipes` — the `APP_PIPE` one is what actually executes for validation errors.

Exceptions are caught by `PrismaExceptionFilter` then `GlobalExceptionFilter` (both `APP_FILTER`, in that provider order) in `src/common/exception.module.ts`. `GlobalExceptionFilter` normalizes the response to `{ statusCode, message, source, details, timestamp }`, logs via `LoggerService`, and reports 5xx errors to Sentry (`SENTRY_DSN` env var). `src/common/interceptors/transform.interceptor.ts` exists but is **not wired up anywhere** — don't assume responses are wrapped in `{ data, statusCode, timestamp }`.

### Authorization is NOT CASL
`src/modules/casl/casl-ability.factory.ts` and `CaslModule` are dead code (entirely commented out / not imported in `app.module.ts`). The `@casl/*` packages are still in `package.json` but unused. Real authorization is the `RequirePermissions`/`PermissionsGuard` system above, backed by `Role` → `RolePermission` → `Permission` (each user has exactly one `roleId`, not a many-to-many). When adding a new endpoint, add `@RequirePermissions({ action: '<verb>', subject: '<entity>' })` and make sure a matching `Permission` row + role grant exists (see `prisma/seed.ts` for the `action`/`subject` naming convention, e.g. `create`/`employees`).

### Auth flows (`src/modules/auth/`)
- **Zalo login** (`POST /auth/login/zalo`, primary path): verifies the Zalo access token server-side, links `ZaloIdentity` to a pre-registered `User` by phone number (first login requires a phone token too). New Zalo users are never auto-created — the phone number must already exist on a `User`.
- **Dev login** (`POST /auth/dev/login`): bypasses Zalo entirely for local/frontend dev. Gated by `AUTH_DEV_MODE=true`, `NODE_ENV !== 'production'`, and a matching `x-dev-auth-secret` header checked with `timingSafeEqual` (see `AuthService.assertDevAuthEnabled`/`assertValidDevAuthSecret`). `src/common/env.validation.ts` throws at boot if `NODE_ENV=production` and `AUTH_DEV_MODE=true`, so this can't accidentally ship live. `pnpm db:seed` provisions a ready-to-use dev employee for this (phone `0900000001` / configurable via `DEV_EMPLOYEE_PHONE` env, `Employee` role, its own `DEV` branch) — log in by posting `{ phone: "0900000001" }` (or `email`/`employeeId`) to `/auth/dev/login` with the `x-dev-auth-secret` header set to `AUTH_DEV_SECRET`.
- **Password login** (`LocalAuthGuard`) still exists for the `password` field on `User` but Zalo is the primary path going forward; treat password-reset code as deprecated (commented out in `AuthService`).
- Access + refresh tokens are both JWT; refresh tokens are additionally persisted hashed in the `RefreshToken` table for rotation/revocation (`RefreshTokenService`), tracking `source`/`device`/`ipAddress` per session.

### Domain model (see `prisma/schema.prisma`)
Two-layer shift design — **templates** (reusable definitions) generate **instances** (dated occurrences):

```
Branch
 ├─ MasterShiftTemplate  ──generates──▶ MasterShift (per workDate)
 │     └─ SubShiftTemplate ──────────▶      └─ SubShift
 │           └─ TaskTemplate ────────▶            └─ Task ─▶ TaskCompletion
 └─ BranchScheduleConfig (per-branch scheduling rules)

Employee ──Availability (registers interest in a SubShift)
         ──Assignment (employee ↔ SubShift, optionally from an Availability)
                ├─ AttendanceHistory (check-in/out/replacement/manager-adjust log)
                ├─ LeaveRequest (absence + replacement employee, approval workflow)
                └─ TimeLog ─▶ PayrollEntry ─▶ PayPeriod
```

- `SubShiftType`: `MAIN` vs `SUPPORT`. `TaskType`: `SHARED_MANDATORY` / `SHARED_OPTIONAL` / `DEDICATED` — tasks can attach to a template, a master shift, or a sub-shift depending on scope.
- Every mutable model carries `createdAt/createdBy/updatedAt/updatedBy` audit columns (`Int` user IDs) — **no soft deletes**; `.delete()` is a real Prisma delete, and services catch `Prisma.PrismaClientKnownRequestError` codes `P2002` (unique conflict → `BadRequestException`) and `P2025` (not found → `NotFoundException`) rather than pre-checking existence in most write paths.
- `Employee.userId` is nullable — an employee record can exist before it's linked to a login-capable `User`.

### Module structure
Each `src/modules/<name>/` follows: `<name>.module.ts`, `<name>.service.ts` (Prisma calls + business logic), `<name>.controller.ts` (HTTP + guards + Swagger), `<name>.mapper.ts` (static mapper class translating Prisma models → response DTOs, e.g. `EmployeeMapper.toDto`), `<name>.types.ts` (shared Prisma `include`/`select` const objects using `satisfies Prisma.XInclude`, plus derived `Prisma.XGetPayload` types), `dto/*.dto.ts`. Follow `src/modules/employees/` as the reference implementation — it's the most complete example (branch assignment, hourly rate sync via `$transaction`, mapper composition for partial includes).

New modules must be registered in `src/app.module.ts`'s `imports` array or their routes 404.

### Testing conventions
Unit specs mock `PrismaService` per-method (`jest.fn()`); e2e specs boot the full `AppModule` and hit real routes with `supertest`. `test/jest-e2e.json` only picks up `*.e2e-spec.ts` from repo root (`rootDir: "."`), separate from the unit-test jest config in `package.json` (`rootDir: "src"`, `*.spec.ts`).

## Environment variables

Validated at boot by `src/common/env.validation.ts` (missing/invalid values throw on startup): `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION` are required; `AUTH_DEV_MODE`, `AUTH_DEV_SECRET` are optional but required together to use dev login, and rejected outright when `NODE_ENV=production`. `.env.example` has placeholder values — `PORT` there is 3000 but the app defaults to 3001 if unset.
