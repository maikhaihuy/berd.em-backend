---
name: crud-generation
description: 'Scaffold new CRUD modules with complete structure: service, controller, DTOs, tests, and proper NestJS patterns. Use when: creating a new feature module, adding domain entities, implementing resource endpoints. Generates boilerplate following project conventions (Prisma includes, Swagger decorators, CASL guards).'
argument-hint: 'Ask "Create a CRUD module for employees" or "Scaffold a new shifts feature"'
---

# CRUD Module Generation

Scaffolds complete, production-ready CRUD modules following BERD.EM conventions with proper structure, patterns, and tests.

## When to Use

- **New feature module**: Building a new domain entity (e.g., Departments, Teams, Payroll)
- **Resource endpoints**: Need full CRUD (Create, Read, Update, Delete) API
- **Time-saving**: Avoid repetitive boilerplate for standard patterns
- **Consistency**: Ensure new modules match existing project conventions
- **Documentation**: Auto-generated Swagger decorators for API docs

## Prerequisites

- NestJS project with Prisma ORM
- Target entity already defined in `prisma/schema.prisma`
- Migration applied: `pnpm db:dev`
- Understanding of feature requirements (fields, relationships, validation rules)

## Core Workflow

### Phase 1: Gather Requirements

**Clarify the module scope:**

1. **Entity name** (singular, e.g., "Department", "TimeLog")
2. **Key fields** to expose in API responses
3. **Relationships** (many-to-one, many-to-many, one-to-one)
4. **Validation rules** (required fields, length, format constraints)
5. **Authentication required?** (typically yes for BERD.EM)
6. **Authorization rules** (CASL abilities, role-based restrictions)
7. **Soft delete or hard delete?** (common: soft delete for audit trails)

### Phase 2: Generate Module Structure

Create the folder and standard files:

```
src/modules/department/
├── department.module.ts             # Module definition
├── department.service.ts            # Business logic
├── department.controller.ts         # HTTP endpoints
├── department.mapper.ts             # Optional: Response transformation
├── department.types.ts              # Optional: Types/enums
└── dto/
    ├── create-department.dto.ts     # Create payload
    ├── update-department.dto.ts     # Update payload
    └── department-response.dto.ts   # Response structure
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

**Response DTO with Exclude for sensitive fields:**

```typescript
// dto/department-response.dto.ts
import { Exclude, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Engineering' })
  name: string;

  @ApiProperty({ example: 'Building software products' })
  description: string;

  @ApiProperty({ example: '2026-05-01T10:00:00Z' })
  createdAt: Date;

  @Exclude() // Don't expose in response
  deletedAt?: Date;

  @ApiProperty({ example: 'uuid-456' })
  createdBy: string;
}
```

### Phase 4: Implement Service (Business Logic)

**Service patterns with Prisma and relation loading:**

```typescript
// department.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto, userId: string): Promise<Department> {
    return this.prisma.department.create({
      data: {
        ...dto,
        createdBy: userId,
      },
      include: {
        creator: { select: { id: true, email: true } },
        // Include other relations here
      },
    });
  }

  async findAll(): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: { deletedAt: null }, // Soft delete filter
      include: {
        creator: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Department | null> {
    return this.prisma.department.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        creator: { select: { id: true, email: true } },
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: {
        creator: { select: { id: true, email: true } },
      },
    });
  }

  async delete(id: string): Promise<Department> {
    // Soft delete
    return this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

**Key patterns:**

- Always `.include()` relations to avoid N+1 queries
- Use `where: { deletedAt: null }` for soft deletes
- Return domain object, let controller handle DTO transformation
- Throw meaningful errors (use global exception filters)

### Phase 5: Create Controller (HTTP Endpoints)

**Controller with Swagger decorators and guards:**

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
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';
import { AuthenticatedUser } from '../../modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '../../modules/auth/dto/authenticated-user.dto';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({
    status: 201,
    type: DepartmentResponseDto,
    description: 'Department created successfully',
  })
  async create(
    @Body() dto: CreateDepartmentDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<DepartmentResponseDto> {
    const created = await this.service.create(dto, user.userId);
    return new DepartmentResponseDto(created);
  }

  @Get()
  @ApiOperation({ summary: 'Get all departments' })
  @ApiResponse({
    status: 200,
    type: [DepartmentResponseDto],
    description: 'List of all departments',
  })
  async findAll(): Promise<DepartmentResponseDto[]> {
    const departments = await this.service.findAll();
    return departments.map((d) => new DepartmentResponseDto(d));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiResponse({
    status: 200,
    type: DepartmentResponseDto,
  })
  async findById(@Param('id') id: string): Promise<DepartmentResponseDto> {
    const department = await this.service.findById(id);
    return new DepartmentResponseDto(department);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({
    status: 200,
    type: DepartmentResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    const updated = await this.service.update(id, dto);
    return new DepartmentResponseDto(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department (soft delete)' })
  @ApiResponse({ status: 204 })
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }
}
```

**Key patterns:**

- `@UseGuards(JwtAccessGuard)` for authentication
- `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` for Swagger docs
- `@AuthenticatedUser()` to inject current user
- `@HttpCode()` to set correct response codes
- DTO transformation in controller (service returns domain object)

### Phase 6: Register Module

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

### Phase 7: Write Tests

**Unit test template:**

```typescript
// department.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: PrismaService;

  const mockDepartment = {
    id: 'uuid-123',
    name: 'Engineering',
    description: 'Building software',
    createdAt: new Date(),
    createdBy: 'user-123',
    deletedAt: null,
    creator: { id: 'user-123', email: 'user@example.com' },
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
              findFirst: jest.fn(),
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
      const createDto = {
        name: 'Engineering',
        description: 'Building software',
      };

      jest.spyOn(prisma.department, 'create').mockResolvedValue(mockDepartment);

      const result = await service.create(createDto, 'user-123');

      expect(result).toEqual(mockDepartment);
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          createdBy: 'user-123',
        },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return all departments excluding soft deleted', async () => {
      jest
        .spyOn(prisma.department, 'findMany')
        .mockResolvedValue([mockDepartment]);

      const result = await service.findAll();

      expect(result).toEqual([mockDepartment]);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
```

**E2E test template:**

```typescript
// test/department.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Departments (E2E)', () => {
  let app: INestApplication;
  let validToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    // Get valid token from auth endpoint
    // This would depend on your auth setup
    validToken = 'Bearer <token>';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/departments', () => {
    it('should create a department', () => {
      const createDto = {
        name: 'Engineering',
        description: 'Building software',
      };

      return request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', validToken)
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Engineering');
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/departments')
        .send({ name: 'Engineering' })
        .expect(401);
    });
  });

  describe('GET /api/departments', () => {
    it('should return list of departments', () => {
      return request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', validToken)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
```

### Phase 8: Migrate & Test

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
   - Visit Swagger: http://localhost:3000/api/docs
   - Test endpoints with sample data

## Troubleshooting Guide

| Issue                       | Cause                                         | Solution                                                  |
| --------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| 404 on new endpoints        | Module not imported in app.module.ts          | Check `app.module.ts` imports array                       |
| Validation errors           | DTO missing validators or bad decorators      | Check `class-validator` + `class-transformer` imports     |
| N+1 queries in tests        | Missing `.include()` in service               | Add all required relations to `.include()`                |
| Swagger docs missing        | Missing `@ApiOperation()` or `@ApiResponse()` | Add Swagger decorators to controller methods              |
| Soft delete not working     | Queries not filtering `deletedAt: null`       | Add `where: { deletedAt: null }` to all find operations   |
| Test fails with Prisma mock | Mock not matching method signature            | Verify mock has correct structure (include, select, etc.) |

## Key Principles

1. **Consistency**: Follow existing patterns in the codebase
2. **Validation**: Always validate input with DTOs
3. **Relationships**: Always load related data (avoid N+1 queries)
4. **Documentation**: Use Swagger decorators for self-documenting API
5. **Testing**: Write both unit and E2E tests
6. **Soft deletes**: Use `deletedAt` for audit trails, not hard deletes
7. **Authorization**: Add CASL rules if role-based access is needed

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
# http://localhost:3000/api/docs
```

## See Also

- [AGENTS.md](../../../../AGENTS.md) — Project overview and module patterns
- [prisma/schema.prisma](../../../../prisma/schema.prisma) — Database schema definition
- [src/modules/employees/](../../../../src/modules/employees/) — Example CRUD module
