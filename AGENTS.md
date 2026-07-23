# Agent Instructions for BERD.EM Backend

This document helps AI coding agents quickly understand the codebase structure, conventions, and workflows for the Employee Shift & Payroll Management API.

## Project Overview

**BERD.EM** is a NestJS-based REST API for managing employee shifts, time tracking, payroll, and leave management. It features Zalo authentication, role-based access control via CASL, and PostgreSQL persistence through Prisma.

- **Framework**: NestJS 11 with TypeScript
- **Database**: PostgreSQL with Prisma ORM 6.13.0
- **Authentication**: JWT (access + refresh tokens) + Zalo OAuth
- **Authorization**: CASL (role-based + dynamic ability rules)
- **API Docs**: Swagger/OpenAPI
- **Package Manager**: pnpm
- **Testing**: Jest + Supertest (E2E)

## Quick Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm run start:dev        # Run in watch mode
pnpm run build            # Build for production
pnpm start:prod           # Run built app

# Testing
pnpm test                 # Run unit tests
pnpm test:watch          # Run tests in watch mode
pnpm test:cov            # Run with coverage report
pnpm test:e2e            # Run E2E tests

# Database
pnpm db:dev              # Create migration and sync dev DB
pnpm db:reset            # Reset DB and run all migrations + seed
pnpm db:push             # Sync schema to DB without creating migration
pnpm db:seed             # Run seed script

# Code Quality
pnpm lint                # Fix linting issues
pnpm format              # Format code with Prettier
```

## Project Structure

```
src/
├── main.ts                          # App bootstrap (Swagger setup, global pipes)
├── app.module.ts                    # Root module (imports all feature modules)
├── common/                          # Shared utilities
│   ├── decorators/                  # Custom decorators (e.g., @AuthenticatedUser, @CheckAbility)
│   ├── exceptions/                  # Custom exception classes
│   ├── filters/                     # Exception filters (Prisma, HTTP, global)
│   ├── guards/                      # Auth guards (JWT access/refresh, CASL abilities)
│   ├── helpers/                     # Utilities (date, etc.)
│   ├── interceptors/                # Response transform interceptor
│   ├── logger/                      # Logger service
│   ├── services/                    # Shared services (PasswordService)
│   └── env.validation.ts            # Environment variable schema
├── modules/                         # Feature modules
│   ├── auth/                        # Authentication (JWT, Zalo, refresh tokens)
│   ├── users/                       # User management
│   ├── employees/                   # Employee CRUD + hourly rates + branches
│   ├── shifts/                      # Shift management
│   ├── branches/                    # Branch/location management
│   ├── roles/                       # Role definitions
│   ├── permissions/                 # Permission definitions
│   ├── role-permissions/            # Role ↔ Permission assignments
│   ├── user-branches/               # User ↔ Branch assignments (multi-branch)
│   ├── casl/                        # CASL ability factory (authorization rules)
│   ├── work-slots/                  # Work slot scheduling (replaces Schedule/Roster)
│   ├── attendance-history/          # Attendance tracking
│   ├── leave-requests/              # Leave request workflow
│   ├── time-tracking/               # Time log management
│   ├── employee-hourly-rates/       # Employee hourly rate tracking
│   ├── availability/                # Employee shift availability
│   └── prisma/                      # Prisma client module (singleton)
└── test/                            # E2E tests (separate Jest config)

prisma/
├── schema.prisma                    # Schema definition (current: ERD v0.3.1)
├── migrations/                      # Migration history
└── seed.ts                          # Database seeding script

plans/                               # Architecture & implementation docs
├── architecture-diagram.md          # System architecture
├── executive-summary.md             # High-level overview
├── implementation-checklist.md      # Progress tracker
├── next-steps-guide.md              # Planned features & improvements
└── schema-update-and-crud-implementation.md
```

## Module Structure Pattern

Every feature module follows this standard structure:

```
modules/example/
├── example.module.ts                # Module definition + imports
├── example.service.ts               # Business logic
├── example.controller.ts            # HTTP endpoints + decorators
├── example.mapper.ts                # Optional: Response transformation
├── example.types.ts                 # Optional: TypeScript types/enums
└── dto/
    ├── create-example.dto.ts        # Input validation
    ├── update-example.dto.ts        # Update payload
    └── example-response.dto.ts      # Response structure (with @Exclude, @Transform)
```

### Typical Controller Pattern

```typescript
@ApiTags('examples')
@UseGuards(JwtAccessGuard) // Require authentication
@Controller('examples')
export class ExamplesController {
  constructor(private readonly service: ExamplesService) {}

  @Post()
  @CheckAbility((ability, subject) => ability.can('create', subject)) // Optional CASL
  @ApiOperation({ summary: 'Create example' })
  async create(
    @Body() dto: CreateExampleDto,
    @AuthenticatedUser() user: AuthenticatedUserDto, // Current user
  ): Promise<ExampleResponseDto> {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @ApiResponse({ status: 200, type: [ExampleResponseDto] })
  async findAll(): Promise<ExampleResponseDto[]> {
    return this.service.findAll();
  }
}
```

### Typical Service Pattern

```typescript
@Injectable()
export class ExamplesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExampleDto, userId: string): Promise<Example> {
    return this.prisma.example.create({
      data: {
        ...dto,
        createdBy: userId,
      },
      include: {
        // Always include relations for complete response
        creator: { select: { id: true, email: true } },
      },
    });
  }

  async findAll(): Promise<Example[]> {
    return this.prisma.example.findMany({
      include: { creator: true }, // Avoid N+1 queries
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

## Database Schema (ERD v0.3.1)

Key models and their purposes:

- **User**: Base user record (Zalo auth, email, roles)
- **Employee**: Employee details (hire date, department, contact info)
- **UserBranch**: Multi-branch assignment for users (with primary branch flag)
- **Branch**: Physical location/branch definition
- **Shift**: Work shift definitions (time ranges, repeat patterns)
- **WorkSlot**: Individual scheduled shifts (replaces Schedule + Roster)
- **TimeLog**: Time tracking entries (clock in/out, status)
- **AttendanceHistory**: Historical attendance records
- **LeaveRequest**: Leave request workflow (pending → approved/rejected)
- **Role**: User roles (Admin, Manager, Employee, etc.)
- **Permission**: Fine-grained permissions (e.g., "create:employees", "delete:leaves")
- **RolePermission**: Role ↔ Permission many-to-many join table
- **EmployeeHourlyRate**: Hourly pay rates per employee per branch
- **Availability**: Employee shift preferences and availability

See [prisma/schema.prisma](prisma/schema.prisma) for full schema.

## Authentication & Authorization

### Authentication Flow

1. **Zalo OAuth**: Mobile app receives Zalo code → backend exchanges for Zalo user → finds/creates User → issues JWT
2. **JWT Access Token**: Signed with `JWT_ACCESS_SECRET`, expires in minutes (configurable)
3. **JWT Refresh Token**: Longer-lived token stored in DB for token rotation

**Relevant Files:**

- [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts) - Main auth logic
- [src/modules/auth/zalo-auth.service.ts](src/modules/auth/zalo-auth.service.ts) - Zalo integration
- [src/modules/auth/jwt-token.service.ts](src/modules/auth/jwt-token.service.ts) - Token generation
- [src/modules/auth/refresh-token.service.ts](src/modules/auth/refresh-token.service.ts) - Token rotation

### Authorization (CASL)

CASL provides role-based + dynamic ability rules. Example:

```typescript
// Managers can update employees in their own branches
ability.can('update', 'Employee', { branchId: user.primaryBranchId });

// Admins can do anything
if (user.roles.some((r) => r.name === 'Admin')) {
  ability.manage('all'); // Can do anything to any subject
}
```

**Relevant Files:**

- [src/modules/casl/casl-ability.factory.ts](src/modules/casl/casl-ability.factory.ts) - Define ability rules
- [src/common/guards/abilities.guard.ts](src/common/guards/abilities.guard.ts) - Enforce in endpoints
- [src/common/decorators/abilities.decorator.ts](src/common/decorators/abilities.decorator.ts) - Mark protected endpoints

## Global Exception Handling

All exceptions are caught by exception filters and returned in a standardized format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Custom Prisma exceptions are mapped to appropriate HTTP codes. See:

- [src/common/filters/global-exception.filter.ts](src/common/filters/global-exception.filter.ts)
- [src/common/filters/prisma-exception.filter.ts](src/common/filters/prisma-exception.filter.ts)

## Common Development Tasks

### Add a New CRUD Module

1. **Create folder** `src/modules/feature/` with standard structure
2. **Define DTOs** in `dto/` folder:
   - `create-feature.dto.ts` - Input validation
   - `update-feature.dto.ts` - Update payload
   - `feature-response.dto.ts` - Response (use `@Exclude()` for sensitive fields)
3. **Write service** with Prisma queries:
   - Always `.include()` relations (avoid N+1 queries)
   - Use `await` for all async operations
   - Throw meaningful errors
4. **Create controller** with Swagger decorators:
   - Tag with `@ApiTags('feature')`
   - Use `@JwtAccessGuard` for auth
   - Add `@ApiOperation()` and `@ApiResponse()` for docs
   - Inject current user via `@AuthenticatedUser()` decorator
5. **Register in app.module.ts** imports array
6. **Add tests** in `feature.controller.spec.ts` and `feature.service.spec.ts`

See [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) for module completion status.

### Database Migrations

Whenever schema changes:

```bash
pnpm db:dev --name "descriptive_change_name"
```

This:

1. Detects your schema changes from `prisma/schema.prisma`
2. Generates a migration file in `prisma/migrations/`
3. Applies it to your dev database
4. Regenerates Prisma client

**Best Practices:**

- Always provide descriptive migration names
- Run migrations locally first
- Test with `pnpm db:seed` to verify seeding still works
- Never manually edit migration files
- If schema drift occurs, use skill `database-lifecycle` or run `pnpm db:reset`

### Add Tests

**Unit Test Pattern** (`src/modules/feature/feature.service.spec.ts`):

```typescript
describe('FeatureService', () => {
  let service: FeatureService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: PrismaService,
          useValue: { feature: { create: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a feature', async () => {
    jest.spyOn(prisma.feature, 'create').mockResolvedValue(mockFeature);
    const result = await service.create(createDto, userId);
    expect(result).toEqual(mockFeature);
  });
});
```

**E2E Test Pattern** (`test/feature.e2e-spec.ts`):

```typescript
describe('Feature E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('POST /api/features should create', () => {
    return request(app.getHttpServer())
      .post('/api/features')
      .set('Authorization', `Bearer ${validToken}`)
      .send(createDto)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
      });
  });
});
```

## Skills & Workflows

### Database Lifecycle Skill

When working with database schema, migrations, seeds, or query optimization, use the **database-lifecycle** skill:

- **Schema review**: Design or audit schema structure, relationships, indexes
- **Migration issues**: Diagnose rollback failures, conflicts, or drift
- **Seed validation**: Review seed scripts for idempotency and ordering
- **Query optimization**: Detect N+1 patterns, suggest `.include()` usage

Trigger with: "Review my seed script" or "Diagnose this migration problem"

See [.github/skills/database-lifecycle/SKILL.md](.github/skills/database-lifecycle/SKILL.md) for detailed workflow.

## Common Pitfalls & Solutions

| Issue                           | Root Cause                                    | Fix                                                  |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| N+1 queries in responses        | Missing `.include()` in service               | Add `.include()` with all required relations         |
| 404 on endpoints                | Module not imported in app.module.ts          | Check app.module.ts imports array                    |
| "User not authenticated"        | Missing `@UseGuards(JwtAccessGuard)`          | Add guard to controller class or method              |
| Seed fails with FK error        | Parent created after child                    | Check seed.ts creation order (parents first)         |
| Prisma type mismatch            | Schema changed, client not regenerated        | Run `pnpm db:dev` or `pnpm prisma generate`          |
| Test fails with database locked | Running multiple migrations/seeds in parallel | Use `pnpm prisma migrate resolve` or `pnpm db:reset` |

## Environment Variables

Required `.env` file variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/berd_em_dev
JWT_ACCESS_SECRET=your_secret_key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRATION=7d
ZALO_APP_ID=your_zalo_app_id
ZALO_APP_SECRET=your_zalo_app_secret
ZALO_OAUTH_ENDPOINT=https://...
NODE_ENV=development
```

See `src/common/env.validation.ts` for full schema.

## Resources

- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Docs**: https://www.prisma.io/docs
- **CASL Docs**: https://casl.js.org
- **ERD & Architecture**: [plans/](plans/)
- **Implementation Status**: [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md)
- **Database Skill**: [.github/skills/database-lifecycle/SKILL.md](.github/skills/database-lifecycle/SKILL.md)

---

**Last Updated**: May 2026  
**ERD Version**: v0.3.1  
**Maintainer**: BERD.EM Team
