---
name: crud-generation
description: 'Scaffold new CRUD modules with complete structure: service, controller, DTOs, mapper, types, tests, and proper NestJS patterns. Use when: creating a new feature module, adding domain entities, implementing resource endpoints. Generates boilerplate following project conventions (Int autoincrement ids, no soft delete, Prisma includes, Swagger decorators, the RequirePermissions guard).'
argument-hint: 'Ask "Create a CRUD module for employees" or "Scaffold a new shifts feature"'
---

# CRUD Module Generation

Scaffolds complete, production-ready CRUD modules following StaffHub conventions with proper structure, patterns, and tests.

## When to Use

- **New feature module**: Building a new domain entity (e.g., Departments, Teams, Payroll)
- **Resource endpoints**: Need full CRUD (Create, Read, Update, Delete) API
- **Time-saving**: Avoid repetitive boilerplate for standard patterns
- **Consistency**: Ensure new modules match existing project conventions
- **Documentation**: Auto-generated Swagger decorators for API docs

## Prerequisites

- NestJS project with Prisma ORM
- Target entity already defined in `prisma/schema.prisma` with an `Int @id @default(autoincrement())` primary key and `createdAt/createdBy/updatedAt/updatedBy` audit columns (project convention — see any existing model)
- Migration applied: `pnpm db:dev --name "..."`
- Understanding of feature requirements (fields, relationships, validation rules)

## Core Workflow

### Phase 1: Gather Requirements

**Clarify the module scope:**

1. **Entity name** (singular, e.g., "Department", "TimeLog")
2. **Key fields** to expose in API responses
3. **Relationships** (many-to-one, many-to-many, one-to-one)
4. **Validation rules** (required fields, length, format constraints)
5. **Permissions**: which `(action, subject)` pairs gate each route (`create`/`read`/`update`/`delete` × the entity's plural name is the existing convention — see `prisma/seed.ts`), and which roles should be granted them
6. **Delete semantics**: this codebase has **no soft delete anywhere in the schema** — deletes are real `prisma.<model>.delete()` calls. Only introduce a `deletedAt` field if the feature has an explicit audit/undo requirement; don't add it by default.

### Phase 2: Generate Module Structure

Create the folder and standard files (mirrors `src/modules/employees/`):

```
src/modules/department/
├── department.module.ts             # Module definition
├── department.service.ts            # Business logic
├── department.controller.ts         # HTTP endpoints
├── department.mapper.ts             # Static mapper class: Prisma model -> response DTO
├── department.types.ts              # `satisfies Prisma.DepartmentInclude` consts + GetPayload types
└── dto/
    ├── create-department.dto.ts     # Create payload
    ├── update-department.dto.ts     # Update payload
    ├── department.dto.ts            # Plain DTO shape(s), e.g. DepartmentDto / DepartmentLiteDto
    └── department-response.dto.ts   # Response DTO composed by the mapper
```

### Phase 3: Write DTOs (Input & Output Validation)

**Create DTOs follow class-validator + class-transformer patterns:**

```typescript
// dto/create-department.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'Engineering',
    description: 'Department name',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Building software products',
    description: 'Department description',
    required: false,
  })
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

**Response DTO — plain interface/class, `id`/`createdBy` are numbers, no `deletedAt`:**

```typescript
// dto/department-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Engineering' })
  name: string;

  @ApiProperty({ example: 'Building software products' })
  description: string | null;

  @ApiProperty({ example: '2026-05-01T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: 1 })
  createdBy: number;
}
```

Response DTOs in this codebase are plain data shapes returned by a mapper (see Phase 4/5) — they are **not** `class-transformer`-decorated classes constructed directly from a Prisma row.

### Phase 4: Write `types.ts` + Mapper

```typescript
// department.types.ts
import { Prisma } from '@prisma/client';

export const departmentWithCreatorInclude = {
  creator: { select: { id: true, fullName: true } },
} satisfies Prisma.DepartmentInclude;

export type DepartmentWithCreator = Prisma.DepartmentGetPayload<{
  include: typeof departmentWithCreatorInclude;
}>;
```

```typescript
// department.mapper.ts
import { Department } from '@prisma/client';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { DepartmentWithCreator } from './department.types';

export class DepartmentMapper {
  static mapBase(department: Department): DepartmentResponseDto {
    return {
      id: department.id,
      name: department.name,
      description: department.description,
      createdAt: department.createdAt,
      createdBy: department.createdBy,
    };
  }

  static toDto(department: DepartmentWithCreator): DepartmentResponseDto {
    return { ...DepartmentMapper.mapBase(department) };
  }

  static toDtos(departments: DepartmentWithCreator[]): DepartmentResponseDto[] {
    return departments.map((d) => DepartmentMapper.toDto(d));
  }
}
```

### Phase 5: Implement Service (Business Logic)

**Service patterns with Prisma, relation loading, and real deletes:**

```typescript
// department.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { DepartmentMapper } from './department.mapper';
import { departmentWithCreatorInclude } from './department.types';

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: CreateDepartmentDto,
    currentUserId: number,
  ): Promise<DepartmentResponseDto> {
    try {
      const department = await this.prisma.department.create({
        data: { ...dto, createdBy: currentUserId, updatedBy: currentUserId },
        include: { ...departmentWithCreatorInclude },
      });
      return DepartmentMapper.toDto(department);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Department name already in use.');
        }
      }
      throw error;
    }
  }

  async findAll(): Promise<DepartmentResponseDto[]> {
    const departments = await this.prisma.department.findMany({
      include: { ...departmentWithCreatorInclude },
      orderBy: { createdAt: 'desc' },
    });
    return DepartmentMapper.toDtos(departments);
  }

  async findOne(id: number): Promise<DepartmentResponseDto> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { ...departmentWithCreatorInclude },
    });
    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found.`);
    }
    return DepartmentMapper.toDto(department);
  }

  async update(
    id: number,
    dto: UpdateDepartmentDto,
    currentUserId: number,
  ): Promise<DepartmentResponseDto> {
    try {
      const department = await this.prisma.department.update({
        where: { id },
        data: { ...dto, updatedBy: currentUserId },
        include: { ...departmentWithCreatorInclude },
      });
      return DepartmentMapper.toDto(department);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Department with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.department.delete({ where: { id } }); // hard delete — no deletedAt in this schema
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Department with ID ${id} not found.`);
      }
      throw error;
    }
  }
}
```

**Key patterns:**

- Always `.include()` relations needed by the mapper (avoid N+1 queries)
- No `deletedAt` filter anywhere — `findMany`/`findUnique` return whatever rows actually exist
- Set `createdBy`/`updatedBy` from the caller's `userId` on every write
- Catch `Prisma.PrismaClientKnownRequestError`: `P2002` → `BadRequestException` (unique conflict), `P2025` → `NotFoundException` (record/relation not found)
- Service returns the mapped response DTO directly; controllers don't do their own transformation

### Phase 6: Create Controller (HTTP Endpoints)

**Controller with Swagger decorators and the permission guard** — `JwtAccessGuard` and `PermissionsGuard` are registered **globally** (`src/common/authz.module.ts`), so controllers do NOT add `@UseGuards(JwtAccessGuard)`; every route is authenticated by default and must declare `@RequirePermissions()` (or `@Public()`/`@SkipPermissions()`) or it 403s:

```typescript
// department.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';

@ApiTags('departments')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  @Post()
  @RequirePermissions({ action: 'create', subject: 'departments' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, type: DepartmentResponseDto })
  async create(
    @Body() dto: CreateDepartmentDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<DepartmentResponseDto> {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'departments' })
  @ApiOperation({ summary: 'Get all departments' })
  @ApiResponse({ status: 200, type: [DepartmentResponseDto] })
  async findAll(): Promise<DepartmentResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'departments' })
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiResponse({ status: 200, type: DepartmentResponseDto })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DepartmentResponseDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'update', subject: 'departments' })
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, type: DepartmentResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<DepartmentResponseDto> {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions({ action: 'delete', subject: 'departments' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }
}
```

**Key patterns:**

- `@RequirePermissions({ action, subject })` per route — not `@UseGuards(JwtAccessGuard)`, which is redundant (already global)
- `ParseIntPipe` on `:id` params — ids are `number`, not `string`/UUID
- `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` for Swagger docs
- `@AuthenticatedUser()` to inject the current user (from the JWT payload)
- Service already returns the response DTO — no `new XResponseDto(...)` wrapping in the controller

### Phase 7: Register Module + Seed Permissions

Add to `src/app.module.ts`:

```typescript
// ... other imports
import { DepartmentModule } from './modules/department/department.module';

@Module({
  imports: [
    // ... other modules
    DepartmentModule,
  ],
})
export class AppModule {}
```

Add the new `(action, subject)` pairs to `prisma/seed.ts`'s `permissionsSeed` list (following the existing `['branches', 'employees', ...].flatMap(...)` pattern) and grant them to the roles that need them, or `@RequirePermissions()` on the new routes will never be satisfiable. Re-run `pnpm db:seed`.

### Phase 8: Write Tests

**Unit test template:**

```typescript
// department.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: PrismaService;

  const mockDepartment = {
    id: 1,
    name: 'Engineering',
    description: 'Building software',
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: PrismaService,
          useValue: {
            department: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a department', async () => {
      const createDto = { name: 'Engineering', description: 'Building software' };

      jest.spyOn(prisma.department, 'create').mockResolvedValue(mockDepartment);

      const result = await service.create(createDto, 1);

      expect(result).toEqual(expect.objectContaining({ id: 1, name: 'Engineering' }));
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { ...createDto, createdBy: 1, updatedBy: 1 },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return all departments', async () => {
      jest.spyOn(prisma.department, 'findMany').mockResolvedValue([mockDepartment]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('remove', () => {
    it('should hard-delete a department', async () => {
      jest.spyOn(prisma.department, 'delete').mockResolvedValue(mockDepartment);

      await service.remove(1);

      expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
```

**E2E test template** — note guards are global, so bypass them at the module level rather than per-controller:

```typescript
// test/department.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAccessGuard } from '../src/common/guards/jwt-access.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';

describe('Departments (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/departments should create a department', () => {
    return request(app.getHttpServer())
      .post('/api/departments')
      .send({ name: 'Engineering', description: 'Building software' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Engineering');
      });
  });

  it('GET /api/departments should return a list', () => {
    return request(app.getHttpServer())
      .get('/api/departments')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

For an E2E test that actually exercises real auth/permission checks instead of overriding the guards, log in through `/api/auth/dev/login` first (see the `test-writing` skill).

### Phase 9: Migrate & Test

1. **Run migration** (if entity is new):

   ```bash
   pnpm db:dev --name "add_department_entity"
   ```

2. **Run tests**:

   ```bash
   pnpm test department
   pnpm test:e2e
   ```

3. **Manual testing**:
   - Start dev server: `pnpm run start:dev`
   - Visit Swagger: http://localhost:3001/docs (note: served without the `/api` prefix)
   - Test endpoints with sample data

## Troubleshooting Guide

| Issue                                       | Cause                                                        | Solution                                                            |
| -------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Every request to the new route 403s          | No `@RequirePermissions()` (and not `@Public()`/`@SkipPermissions()`) | Add `@RequirePermissions({ action, subject })` and seed that permission |
| 404 on new endpoints                        | Module not imported in `app.module.ts`                           | Check `app.module.ts` imports array                                     |
| Validation errors                           | DTO missing validators or bad decorators                         | Check `class-validator` + `class-transformer` imports                   |
| N+1 queries in tests                        | Missing `.include()` in service                                  | Add all required relations to `.include()`                              |
| Swagger docs missing                        | Missing `@ApiOperation()` or `@ApiResponse()`                    | Add Swagger decorators to controller methods                            |
| Test fails with Prisma mock                 | Mock not matching method signature                              | Verify mock has correct structure (include, select, etc.)               |
| E2E test 401/403 despite `@Public()` route   | Forgot to override `JwtAccessGuard`/`PermissionsGuard` at the `TestingModule` level for non-public routes | Both guards are global — override them in the test module, not the controller |

## Key Principles

1. **Consistency**: Follow existing patterns in the codebase
2. **Validation**: Always validate input with DTOs
3. **Relationships**: Always load related data (avoid N+1 queries)
4. **Documentation**: Use Swagger decorators for self-documenting API
5. **Testing**: Write both unit and E2E tests
6. **No soft deletes by default**: Prisma `.delete()` is a real delete in this schema; don't add `deletedAt` unless the feature explicitly needs it
7. **Authorization**: Add `@RequirePermissions({ action, subject })` and seed the matching `Permission` row — CASL is dead code in this project, don't use it

## Quick Reference Commands

```bash
# Create new migration if entity is new
pnpm db:dev --name "add_department"

# Generate tests
pnpm test department

# Run E2E tests
pnpm test:e2e

# Start dev server and test manually
pnpm run start:dev

# Visit Swagger docs
# http://localhost:3001/docs
```

## See Also

- [AGENTS.md](../../../../AGENTS.md) — Project overview and module patterns
- [prisma/schema.prisma](../../../../prisma/schema.prisma) — Database schema definition
- [src/modules/employees/](../../../../src/modules/employees/) — Reference CRUD module (branch assignment, hourly-rate sync, mapper composition)
