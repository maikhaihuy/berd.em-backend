# Agent Instructions for StaffHub Backend

This document helps AI coding agents quickly understand the codebase structure, conventions, and workflows for the Employee Shift & Payroll Management API.

> **Note**: this file was substantially rewritten to match the current codebase and is kept in sync with `CLAUDE.md` — update both together. The project skills under `.claude/skills/` are likewise up to date with these conventions. Trust `prisma/schema.prisma` and `src/` over anything that contradicts it.

## Project Overview

**StaffHub** (`package.json` name: `berd.em-backend`) is a NestJS-based REST API for managing employee shifts, task assignment, time tracking, and payroll. Auth is Zalo Mini App OAuth (primary) plus JWT access/refresh tokens; authorization is a custom permission system (**not** CASL, despite the package still being installed).

- **Framework**: NestJS 11 with TypeScript
- **Database**: PostgreSQL with Prisma ORM 6.13.0, `Int` autoincrement primary keys throughout, no soft deletes (hard `.delete()`, audit columns instead)
- **Authentication**: Zalo OAuth (primary), JWT access + refresh, a gated dev-login backdoor for local/frontend dev
- **Authorization**: Custom `(action, subject)` permission guard — deny-by-default
- **API Docs**: Swagger/OpenAPI at `/docs`
- **Package Manager**: pnpm
- **Testing**: Jest (unit, `rootDir: src`) + Supertest (E2E, separate config in `test/jest-e2e.json`)

## Quick Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm run start:dev        # Run in watch mode (port from .env PORT, default 3001)
pnpm run build            # Build for production
pnpm start:prod           # Run built app

# Testing
pnpm test                 # Run unit tests
pnpm test <name-fragment>  # Run matching spec files, e.g. `pnpm test employee.service`
pnpm test:watch           # Run tests in watch mode
pnpm test:cov             # Run with coverage report
pnpm test:e2e             # Run E2E tests (test/*.e2e-spec.ts)

# Database
pnpm db:dev --name "descriptive_change_name"   # Create migration and sync dev DB
pnpm db:reset             # Reset DB and run all migrations + seed
pnpm db:push              # Sync schema to DB without creating migration
pnpm db:deploy            # Apply pending migrations (prod-style)
pnpm db:seed              # Run seed script (prisma/seed.ts)

# Code Quality
pnpm lint                 # Fix linting issues
pnpm format               # Format code with Prettier
```

`DATABASE_URL` must point at a reachable Postgres instance before any `db:*` command works — there's no bundled Docker/DB bootstrap script.

## OpenSpec Workflow (Spec-Driven Changes)

This project tracks non-trivial changes through OpenSpec (`openspec/`) rather than jumping straight to code: propose → apply → archive. `openspec/project.md` carries durable project context for artifact generation; `openspec/specs/<capability>/spec.md` is the synced source of truth per capability once a change is archived; `openspec/changes/` holds work in progress.

Use the Claude Code integration if available — `/opsx:propose` / `/opsx:apply` / `/opsx:archive` (`.claude/commands/opsx/`) — or fall back to the `openspec` CLI directly (`openspec new change <name>`, `openspec status`, `openspec instructions`, `openspec archive`). See [GUIDE_LINE.md](GUIDE_LINE.md) for the full walkthrough.

## Project Structure

```
src/
├── main.ts                          # App bootstrap: global prefix "api", CORS, ValidationPipe, Swagger at /docs
├── app.module.ts                    # Root module — every feature module must be added to its imports array
├── common/                          # Shared, cross-cutting code
│   ├── authz.module.ts              # Registers global guards: JwtAccessGuard then PermissionsGuard
│   ├── exception.module.ts          # Registers global ValidationPipe, exception filters, Sentry init
│   ├── env.validation.ts            # Environment variable schema (class-validator), validated at boot
│   ├── decorators/                  # @Public(), @SkipPermissions(), @RequirePermissions()
│   ├── exceptions/                  # Custom exception base classes
│   ├── filters/                     # PrismaExceptionFilter, GlobalExceptionFilter, HttpExceptionFilter
│   ├── guards/                      # JwtAccessGuard, JwtRefreshGuard, LocalAuthGuard, PermissionsGuard
│   ├── helpers/                     # Utilities (date helper, etc.)
│   ├── interceptors/                # TransformInterceptor — exists but NOT wired up anywhere, don't assume it runs
│   ├── logger/                      # LoggerService
│   └── services/                    # Shared services (PasswordService)
├── modules/                         # Feature modules (each registered in app.module.ts)
│   ├── auth/                        # JWT + Zalo OAuth + dev-login, refresh token rotation
│   ├── users/                       # User accounts (login-capable)
│   ├── employees/                   # Employee CRUD, multi-branch assignment, hourly rates
│   ├── employee-hourly-rates/       # Hourly pay rate history per employee
│   ├── branches/                    # Branch/location + BranchScheduleConfig
│   ├── roles/, permissions/, role-permissions/  # RBAC tables backing the permission guard
│   ├── master-shift-templates/      # Reusable shift template per branch
│   ├── sub-shift-templates/         # Reusable sub-shift template (MAIN/SUPPORT) under a master template
│   ├── task-templates/              # Reusable task definitions attached to templates
│   ├── master-shifts/               # Generated, dated shift instance
│   ├── sub-shifts/                  # Generated sub-shift instance
│   ├── assignments/                 # Employee ↔ SubShift assignment (check-in/out, status)
│   ├── tasks/                       # Generated task instance + completions
│   ├── availability/                # Employee registers interest in a SubShift
│   ├── attendance-history/          # Append-only log of attendance actions per assignment
│   ├── leave-requests/              # Absence + replacement employee workflow
│   ├── time-tracking/               # TimeLog verification → feeds PayrollEntry
│   ├── casl/                        # DEAD CODE — CaslAbilityFactory is fully commented out, module not imported
│   └── prisma/                      # PrismaService (singleton PrismaClient wrapper)
└── test/ directory doesn't exist under src — E2E specs live in top-level test/

prisma/
├── schema.prisma                    # Single source of truth for DB structure
├── migrations/                      # Migration history — never edit applied migration files by hand
└── seed.ts                          # Seeds permissions, roles, a SETTINGS admin user, and a dev-login employee

.claude/skills/                      # Project + OpenSpec skill docs — see "Skills & Workflows" below
```

## Module Structure Pattern

Every feature module follows this structure (see `src/modules/employees/` as the most complete reference — branch assignment, hourly-rate sync via `$transaction`, partial-include mapper composition):

```
modules/example/
├── example.module.ts                # Module definition + imports
├── example.service.ts               # Business logic, all Prisma calls
├── example.controller.ts            # HTTP endpoints + guards + Swagger decorators
├── example.mapper.ts                # Static mapper class: Prisma model -> response DTO (e.g. ExampleMapper.toDto)
├── example.types.ts                 # Shared `satisfies Prisma.XInclude` const objects + derived GetPayload types
└── dto/
    ├── create-example.dto.ts        # Input validation (class-validator + class-transformer)
    ├── update-example.dto.ts        # Update payload
    ├── example.dto.ts               # Full + "Lite" plain DTO shapes
    └── example-response.dto.ts      # Response DTO, composed from the mapper
```

### Typical Controller Pattern

```typescript
@ApiTags('examples')
@ApiBearerAuth()
@Controller('examples')
export class ExamplesController {
  constructor(private readonly service: ExamplesService) {}

  @Post()
  @RequirePermissions({ action: 'create', subject: 'examples' })
  @ApiOperation({ summary: 'Create example' })
  async create(
    @Body() dto: CreateExampleDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<ExampleResponseDto> {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'examples' })
  @ApiResponse({ status: 200, type: [ExampleResponseDto] })
  async findAll(): Promise<ExampleResponseDto[]> {
    return this.service.findAll();
  }
}
```

Note: `JwtAccessGuard` and `PermissionsGuard` are registered **globally** (`src/common/authz.module.ts`), so controllers do NOT need `@UseGuards(JwtAccessGuard)` — every route is authenticated and permission-checked by default unless marked `@Public()` or `@SkipPermissions()`.

### Typical Service Pattern

```typescript
@Injectable()
export class ExamplesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExampleDto, userId: number): Promise<ExampleResponseDto> {
    try {
      const example = await this.prisma.example.create({
        data: { ...dto, createdBy: userId, updatedBy: userId },
        include: { ...exampleInclude }, // avoid N+1 queries
      });
      return ExampleMapper.toDto(example);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new BadRequestException('Duplicate value.');
        if (error.code === 'P2025') throw new NotFoundException('Related record not found.');
      }
      throw error;
    }
  }

  async findAll(): Promise<ExampleResponseDto[]> {
    const rows = await this.prisma.example.findMany({
      include: { ...exampleInclude },
      orderBy: { createdAt: 'desc' },
    });
    return ExampleMapper.toDtos(rows);
  }
}
```

Key patterns actually used in this codebase:

- IDs are `Int` autoincrement, **not UUID**.
- **No soft deletes anywhere in the schema** — `remove()`/`delete()` methods call `prisma.<model>.delete()` directly. Handle FK-not-found via catching Prisma error code `P2025`, not a `deletedAt: null` filter.
- Every mutable model has `createdAt/createdBy/updatedAt/updatedBy` (`Int` user id) audit columns — always set `createdBy`/`updatedBy` from `AuthenticatedUserDto.userId` on writes.
- Always `.include()` relations needed by the response mapper (avoid N+1).
- Mappers are plain static classes (`XMapper.toDto`, `.toDtos`, `.mapBase`, `.mapLite`), not `class-transformer` `@Exclude()`-decorated response classes returned directly from Prisma.

## Database Schema

Prisma models are organized as **templates** (reusable definitions) that generate **dated instances**:

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

Key models:

- **User**: login-capable account (`phoneNumber` unique, optional `password`, one `roleId`). Has an optional `employee` relation and an optional `zaloIdentity` relation.
- **ZaloIdentity**: 1:1 link from a `User` to a Zalo `zaloUserId`, created on first successful Zalo login.
- **Employee**: HR record (name, phone, dates). `userId` is nullable — an employee can exist before being linked to a login account.
- **RefreshToken**: hashed refresh tokens with `source`/`device`/`ipAddress` for session tracking and revocation.
- **Role / Permission / RolePermission**: each `User` has exactly one `Role`; a `Role` has many `Permission`s via the `RolePermission` join table. `Permission.action` + `Permission.subject` are the strings matched by `@RequirePermissions()`.
- **MasterShiftTemplate / SubShiftTemplate / TaskTemplate**: branch-owned, reusable shift/task definitions.
- **MasterShift / SubShift / Task**: dated, generated instances of the templates above (optionally linked back via `*TemplateId`, nullable so a template can be edited/deleted without breaking history).
- **Assignment**: an `Employee` working a specific `SubShift`, optionally originating from an `Availability` registration. Carries `status` (`WorkSlotStatus`) and actual check-in/out times.
- **TimeLog → PayrollEntry → PayPeriod**: time verification feeds payroll calculation (`PayPeriodsModule`/`PayrollEntriesModule` are not yet implemented — see the `TODO`s in `app.module.ts`).

See [prisma/schema.prisma](prisma/schema.prisma) for the full definition, including enums (`ShiftStatus`, `SubShiftType`, `TaskType`, `WorkSlotStatus`, `AttendanceAction`, etc.).

## Authentication & Authorization

### Authentication Flows

1. **Zalo login** (`POST /auth/login/zalo`, primary path): verifies the Zalo access token server-side (`ZaloAuthService.verifyAccessToken`), then links the `ZaloIdentity` to a **pre-registered** `User` found by phone number (first login additionally requires a phone token). Zalo users are never auto-created.
2. **Dev login** (`POST /auth/dev/login`): bypasses Zalo for local/frontend dev. Requires `AUTH_DEV_MODE=true`, `NODE_ENV !== 'production'`, and a matching `x-dev-auth-secret` header (`timingSafeEqual` comparison). `env.validation.ts` throws at boot if `NODE_ENV=production && AUTH_DEV_MODE=true`. `pnpm db:seed` provisions a ready-made dev employee (`phone: '0900000001'` by default, override via `DEV_EMPLOYEE_PHONE`) — log in with `{ phone: "0900000001" }` and the `x-dev-auth-secret` header.
3. **Password login** (`LocalAuthGuard`) still exists on `User.password` but is being phased out in favor of Zalo; password-reset endpoints are commented out/deprecated in `AuthService`.
4. Access + refresh tokens are both JWT. Refresh tokens are additionally persisted **hashed** in the `RefreshToken` table (rotation + revocation), tracking `source`/`device`/`ipAddress` per session (`RefreshTokenService`).

**Relevant Files:**

- [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts) — Main auth logic
- [src/modules/auth/zalo-auth.service.ts](src/modules/auth/zalo-auth.service.ts) — Zalo Graph API integration
- [src/modules/auth/jwt-token.service.ts](src/modules/auth/jwt-token.service.ts) — Token generation
- [src/modules/auth/refresh-token.service.ts](src/modules/auth/refresh-token.service.ts) — Token rotation/revocation

### Authorization — custom permission guard, NOT CASL

`src/modules/casl/casl-ability.factory.ts` is dead code: fully commented out, and `CaslModule` is never imported in `app.module.ts`. The `@casl/ability`/`@casl/prisma` packages remain in `package.json` but are unused — do not extend or "fix" that file; it's not on the request path.

Real authorization is two globally-registered guards, in this order (`src/common/authz.module.ts`, via `APP_GUARD`):

1. **`JwtAccessGuard`** — authenticates via the passport `jwt` strategy. Honors `@Public()`.
2. **`PermissionsGuard`** — authorizes. Honors `@Public()` and `@SkipPermissions()`. **Deny-by-default**: any route that is neither `@Public()` nor `@SkipPermissions()` MUST declare `@RequirePermissions({ action, subject })`, or every request 403s with "This route does not declare required permissions".

```typescript
// Public route (skips auth AND permission check) — login, refresh, health
@Public()
@Post('login/zalo')

// Authenticated but no fine-grained permission needed — logout, active-sessions
@SkipPermissions()
@Post('logout')

// Authenticated + must have this (action, subject) permission granted via their Role
@RequirePermissions({ action: 'create', subject: 'employees' })
@Post()
```

Permission checks compare `(action, subject)` against `user.permissions` on the JWT payload, with `action: 'manage'` or `subject: 'all'` acting as wildcards. Multiple `@RequirePermissions()` rules are ANDed.

**Relevant Files:**

- [src/common/authz.module.ts](src/common/authz.module.ts) — Global guard registration
- [src/common/guards/permissions.guard.ts](src/common/guards/permissions.guard.ts) — Enforcement logic
- [src/common/decorators/public.decorator.ts](src/common/decorators/public.decorator.ts), [skip-permissions.decorator.ts](src/common/decorators/skip-permissions.decorator.ts), [permissions.decorator.ts](src/common/decorators/permissions.decorator.ts)
- `prisma/seed.ts` — shows the `action`/`subject` naming convention (e.g. `create`/`employees`) and how roles are granted permissions

## Global Exception Handling

`src/common/exception.module.ts` registers, as `APP_PIPE`/`APP_FILTER`:

- A `ValidationPipe` (whitelist, transform, forbidNonWhitelisted) with a custom `exceptionFactory` that reshapes class-validator errors into `{ message: 'Validation failed', errors: [{ field, errors }] }`.
- `PrismaExceptionFilter` then `GlobalExceptionFilter` (in that order). `GlobalExceptionFilter` normalizes every response to `{ statusCode, message, source, details, timestamp }`, logs via `LoggerService`, and reports 5xx errors to Sentry (`SENTRY_DSN` env var).

`main.ts` also constructs its own `ValidationPipe` via `app.useGlobalPipes` — the `APP_PIPE` one registered in `ExceptionModule` is what actually executes for validation errors.

See:

- [src/common/filters/global-exception.filter.ts](src/common/filters/global-exception.filter.ts)
- [src/common/filters/prisma-exception.filter.ts](src/common/filters/prisma-exception.filter.ts)
- [src/common/exception.module.ts](src/common/exception.module.ts)

## Common Development Tasks

### Add a New CRUD Module

1. **Create folder** `src/modules/feature/` with the standard structure above.
2. **Define DTOs** in `dto/`: `create-feature.dto.ts`, `update-feature.dto.ts`, `feature.dto.ts` (plain shape), `feature-response.dto.ts`.
3. **Define `feature.types.ts`**: `satisfies Prisma.FeatureInclude` const objects + derived `Prisma.FeatureGetPayload<{...}>` types, following `employee.types.ts`.
4. **Write `feature.mapper.ts`**: static class with `mapBase`, optional `mapX` partial mappers, and `toDto`/`toDtos` entry points that compose them.
5. **Write the service** with Prisma queries:
   - Always `.include()` relations needed by the mapper.
   - Set `createdBy`/`updatedBy` from the authenticated user's `userId` on writes.
   - Catch `Prisma.PrismaClientKnownRequestError` — map `P2002` → `BadRequestException`, `P2025` → `NotFoundException`.
   - No soft delete — use a real `.delete()` unless the feature has an explicit requirement otherwise.
6. **Create the controller**:
   - Tag with `@ApiTags('feature')`, add `@ApiBearerAuth()`.
   - Add `@RequirePermissions({ action, subject })` per route (or `@Public()`/`@SkipPermissions()` if it truly needs neither) — guards are already global, don't add `@UseGuards(JwtAccessGuard)`.
   - Add `@ApiOperation()`/`@ApiResponse()` and inject the user via `@AuthenticatedUser()`.
7. **Register in `app.module.ts`** imports array — routes 404 otherwise.
8. **Seed permissions**: add `{ action, subject }` rows for the new entity in `prisma/seed.ts` and grant them to the relevant roles, or `@RequirePermissions()` will never be satisfiable.
9. **Add tests**: `feature.service.spec.ts` and `feature.controller.spec.ts`.

### Database Migrations

Whenever the schema changes:

```bash
pnpm db:dev --name "descriptive_change_name"
```

This detects schema changes, generates a migration file in `prisma/migrations/`, applies it to the dev database, and regenerates the Prisma client.

**Best Practices:**

- Always provide descriptive migration names.
- Run migrations locally first.
- Run `pnpm db:seed` to verify seeding still works.
- Never manually edit already-applied migration files.
- If schema drift occurs, use the `database-lifecycle` skill or run `pnpm db:reset`.

### Add Tests

Unit tests mock `PrismaService` per-method with `jest.fn()`. E2E tests (`test/*.e2e-spec.ts`, run via `pnpm test:e2e`) boot the full `AppModule` and hit real routes with `supertest`, using a real (dev) database — there's no separate test-DB config, so E2E tests mutate whatever `DATABASE_URL` points at.

See the `test-writing` skill for detailed patterns, but note: `@UseGuards` is **not** on individual controllers in this codebase (guards are global), so tests that need to bypass auth should `.overrideGuard(JwtAccessGuard)` / `.overrideGuard(PermissionsGuard)` at the `TestingModule` level, not assume a per-controller guard to override.

## Skills & Workflows

`.claude/skills/` contains additional workflow docs (`crud-generation`, `database-lifecycle`, `schema-review`, `test-writing`, `nestjs-prisma-expert`), alongside the OpenSpec workflow skills (`openspec-*`). The project skills match this project's actual conventions (Int ids, no soft delete, permission-guard authorization) — if anything in them still contradicts the real code, the code wins.

## Common Pitfalls & Solutions

| Issue                                       | Root Cause                                            | Fix                                                                 |
| -------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Every request 403s on a new route            | Route isn't `@Public()`/`@SkipPermissions()` and has no `@RequirePermissions()` | Add `@RequirePermissions({ action, subject })`, and seed that permission for the role |
| N+1 queries in responses                     | Missing `.include()` in service                       | Add `.include()` with all required relations                        |
| 404 on endpoints                             | Module not imported in `app.module.ts`                | Check `app.module.ts` imports array                                  |
| "This route does not declare required permissions" | Forgot `@RequirePermissions()` on an otherwise-protected route | Add it, or `@SkipPermissions()` if truly none needed |
| Response wrapping in `{ data, statusCode }` assumed but missing | `TransformInterceptor` exists but isn't registered anywhere | Don't rely on it — responses are whatever the controller returns |
| Trying to fix/extend CASL ability rules      | `casl-ability.factory.ts` is commented-out dead code   | Use `@RequirePermissions()` instead                                  |
| Seed fails with FK error                     | Parent created after child                             | Check `seed.ts` creation order (parents first)                      |
| Prisma type mismatch                         | Schema changed, client not regenerated                 | Run `pnpm db:dev` or `pnpm prisma generate`                          |
| Dev login always 403s                        | `AUTH_DEV_MODE`/`AUTH_DEV_SECRET` not set, or `NODE_ENV=production` | Set both env vars, ensure not production, send matching `x-dev-auth-secret` header |

## Environment Variables

Validated at boot by `src/common/env.validation.ts` — missing/invalid required values throw on startup:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/berd_em_dev   # required
JWT_ACCESS_SECRET=your_secret_key                                    # required
JWT_ACCESS_EXPIRATION=15m                                            # required
JWT_REFRESH_SECRET=your_refresh_secret                               # required
JWT_REFRESH_EXPIRATION=7d                                             # required
NODE_ENV=development                                                 # optional
AUTH_DEV_MODE=true                                                   # optional; required (with AUTH_DEV_SECRET) for dev login
AUTH_DEV_SECRET=some_shared_secret                                    # optional; rejected outright if NODE_ENV=production
PORT=3001                                                             # optional, defaults to 3001 in code (.env.example says 3000)
SENTRY_DSN=                                                           # optional, used by GlobalExceptionFilter
```

## Resources

- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Docs**: https://www.prisma.io/docs
- **ERD & Architecture**: [erd/](erd/)
- **Database Skill**: [.claude/skills/database-lifecycle/SKILL.md](.claude/skills/database-lifecycle/SKILL.md)

---

**Last Updated**: 2026-08-01
**Maintainer**: StaffHub Team
