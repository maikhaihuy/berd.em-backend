---
name: test-writing
description: 'Write comprehensive unit and E2E tests for NestJS services and controllers. Use when: adding test coverage, fixing failing tests, testing new features, ensuring CASL/auth guards work. Patterns for mocking Prisma, testing guards, async operations, and database transactions.'
argument-hint: 'Ask "Write tests for the employee service" or "Add E2E tests for auth endpoints"'
---

# Test Writing Guide

Comprehensive patterns for writing unit and E2E tests in BERD.EM following Jest + Supertest conventions.

## When to Use

- **New features**: Add test coverage before/after implementation (TDD)
- **Bug fixes**: Write tests that demonstrate the bug, then fix it
- **Refactoring**: Ensure tests pass before and after refactoring
- **Guard testing**: Verify JWT access, refresh, and CASL ability guards work
- **Database testing**: Mock Prisma for unit tests, real DB for E2E
- **Integration**: Test multiple services/controllers together
- **Coverage**: Aim for >80% coverage on critical paths

## Prerequisites

- Jest configured (`jest.config.json` or in `package.json`)
- `@nestjs/testing` module available
- Supertest for E2E tests
- Understanding of Prisma mocking patterns
- Test database setup for E2E (can reuse dev DB)

## Core Workflow

### Phase 1: Choose Test Type

**Unit Tests** (Fast, isolated):
- Test a single service method or controller endpoint
- Mock all dependencies (Prisma, other services)
- Run in milliseconds
- Good for business logic, edge cases

**Integration Tests** (Moderate speed):
- Test service + controller together
- Mock only external dependencies
- Test real request/response cycle
- Good for guards, middleware, transformations

**E2E Tests** (Slow, full stack):
- Test full request → controller → service → database → response
- Use real database (test DB)
- Test real authentication flows
- Good for complete workflows, edge case scenarios

### Phase 2: Unit Test Pattern (Services)

**Setup and structure:**

```typescript
// department.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: PrismaService;

  // Mock data
  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
  };

  const mockDepartment = {
    id: 'dept-123',
    name: 'Engineering',
    description: 'Building software',
    createdAt: new Date('2026-05-01'),
    createdBy: mockUser.id,
    deletedAt: null,
    creator: mockUser,
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a department with createdBy', async () => {
      const createDto = {
        name: 'Engineering',
        description: 'Building software',
      };

      jest
        .spyOn(prisma.department, 'create')
        .mockResolvedValue(mockDepartment);

      const result = await service.create(createDto, mockUser.id);

      expect(result).toEqual(mockDepartment);
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          createdBy: mockUser.id,
        },
        include: {
          creator: { select: { id: true, email: true } },
        },
      });
    });

    it('should throw on invalid input', async () => {
      const createDto = {
        name: '', // Invalid: empty name
        description: 'Building software',
      };

      // Note: validation happens in DTO, so service assumes valid input
      // But test for business logic errors here
      jest
        .spyOn(prisma.department, 'create')
        .mockRejectedValue(new Error('Unique constraint failed'));

      await expect(service.create(createDto, mockUser.id)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return all non-deleted departments', async () => {
      jest
        .spyOn(prisma.department, 'findMany')
        .mockResolvedValue([mockDepartment]);

      const result = await service.findAll();

      expect(result).toEqual([mockDepartment]);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: {
          creator: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if no departments exist', async () => {
      jest.spyOn(prisma.department, 'findMany').mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return department by id', async () => {
      jest
        .spyOn(prisma.department, 'findFirst')
        .mockResolvedValue(mockDepartment);

      const result = await service.findById('dept-123');

      expect(result).toEqual(mockDepartment);
      expect(prisma.department.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'dept-123',
          deletedAt: null,
        },
        include: {
          creator: { select: { id: true, email: true } },
        },
      });
    });

    it('should return null if department not found', async () => {
      jest.spyOn(prisma.department, 'findFirst').mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should not return deleted department', async () => {
      jest.spyOn(prisma.department, 'findFirst').mockResolvedValue(null);

      const result = await service.findById('dept-123');

      expect(result).toBeNull();
      // Verify deletedAt: null in where clause
      expect(prisma.department.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update department and return updated record', async () => {
      const updateDto = { name: 'Engineering (Updated)' };
      const updatedDepartment = { ...mockDepartment, name: updateDto.name };

      jest
        .spyOn(prisma.department, 'update')
        .mockResolvedValue(updatedDepartment);

      const result = await service.update('dept-123', updateDto);

      expect(result).toEqual(updatedDepartment);
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-123' },
        data: updateDto,
        include: {
          creator: { select: { id: true, email: true } },
        },
      });
    });
  });

  describe('delete', () => {
    it('should soft delete department', async () => {
      const deletedDepartment = { ...mockDepartment, deletedAt: new Date() };

      jest
        .spyOn(prisma.department, 'update')
        .mockResolvedValue(deletedDepartment);

      const result = await service.delete('dept-123');

      expect(result).toEqual(deletedDepartment);
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-123' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
```

**Key patterns:**
- Mock Prisma methods before testing
- Test happy path and error cases
- Use `jest.clearAllMocks()` after each test
- Test the exact Prisma call arguments
- Use `expect.any(Date)` for timestamps

### Phase 3: Unit Test Pattern (Controllers)

**Test guards, decorators, and request/response:**

```typescript
// department.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';
import { AuthenticatedUserDto } from '../../modules/auth/dto/authenticated-user.dto';

describe('DepartmentController', () => {
  let controller: DepartmentController;
  let service: DepartmentService;

  const mockUser: AuthenticatedUserDto = {
    userId: 'user-123',
    email: 'user@example.com',
    roles: [{ id: 'role-1', name: 'Employee' }],
    primaryBranchId: 'branch-1',
  };

  const mockDepartment = {
    id: 'dept-123',
    name: 'Engineering',
    description: 'Building software',
    createdAt: new Date('2026-05-01'),
    createdBy: mockUser.userId,
    deletedAt: null,
    creator: { id: mockUser.userId, email: mockUser.email },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController],
      providers: [
        {
          provide: DepartmentService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAccessGuard)
      .useValue({
        canActivate: () => true, // Mock guard to always allow
      })
      .compile();

    controller = module.get<DepartmentController>(DepartmentController);
    service = module.get<DepartmentService>(DepartmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return department response', async () => {
      const createDto = {
        name: 'Engineering',
        description: 'Building software',
      };

      jest.spyOn(service, 'create').mockResolvedValue(mockDepartment);

      const result = await controller.create(createDto, mockUser);

      expect(result).toHaveProperty('id', mockDepartment.id);
      expect(result).toHaveProperty('name', mockDepartment.name);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.userId);
    });
  });

  describe('findAll', () => {
    it('should return array of department responses', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockDepartment]);

      const result = await controller.findAll();

      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('findById', () => {
    it('should return department by id', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockDepartment);

      const result = await controller.findById('dept-123');

      expect(result).toHaveProperty('id', mockDepartment.id);
      expect(service.findById).toHaveBeenCalledWith('dept-123');
    });

    it('should handle not found gracefully', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      const result = await controller.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and return updated response', async () => {
      const updateDto = { name: 'Engineering (Updated)' };
      const updated = { ...mockDepartment, name: updateDto.name };

      jest.spyOn(service, 'update').mockResolvedValue(updated);

      const result = await controller.update('dept-123', updateDto);

      expect(result).toHaveProperty('name', updateDto.name);
      expect(service.update).toHaveBeenCalledWith('dept-123', updateDto);
    });
  });

  describe('delete', () => {
    it('should delete department', async () => {
      const deletedDept = { ...mockDepartment, deletedAt: new Date() };

      jest.spyOn(service, 'delete').mockResolvedValue(deletedDept);

      await controller.delete('dept-123');

      expect(service.delete).toHaveBeenCalledWith('dept-123');
    });
  });
});
```

**Key patterns:**
- Override guards in `overrideGuard()` to bypass authentication in tests
- Mock service methods
- Test controller logic (transformation, injection), not service logic
- Verify service was called with correct arguments

### Phase 4: E2E Test Pattern

**Full request/response cycle with real database:**

```typescript
// test/department.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Department E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let validToken: string;
  let createdDepartmentId: string;

  // Test user credentials (should exist in seed or created via auth)
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
  };

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

    prisma = module.get<PrismaService>(PrismaService);

    // Login to get token (adjust based on your auth flow)
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(testUser);

    validToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    if (createdDepartmentId) {
      await prisma.department.delete({
        where: { id: createdDepartmentId },
      });
    }
    await app.close();
  });

  describe('POST /api/departments', () => {
    it('should create a department', async () => {
      const createDto = {
        name: 'Engineering Department',
        description: 'Builds software products',
      };

      const response = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createDto.name);
      expect(response.body.description).toBe(createDto.description);

      createdDepartmentId = response.body.id; // Save for cleanup
    });

    it('should fail without authentication', async () => {
      const createDto = {
        name: 'Engineering',
        description: 'Building software',
      };

      await request(app.getHttpServer())
        .post('/api/departments')
        .send(createDto)
        .expect(401); // Unauthorized
    });

    it('should fail with invalid input (validation)', async () => {
      const invalidDto = {
        name: '', // Empty name (invalid)
        description: 'Building software',
      };

      await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidDto)
        .expect(400); // Bad Request
    });

    it('should fail with duplicate name', async () => {
      const createDto = {
        name: 'Duplicate Department',
        description: 'First one',
      };

      // Create first
      const firstResponse = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createDto)
        .expect(201);

      // Try to create duplicate
      await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createDto)
        .expect(400); // Should fail with unique constraint

      // Cleanup
      await prisma.department.delete({
        where: { id: firstResponse.body.id },
      });
    });
  });

  describe('GET /api/departments', () => {
    it('should return list of departments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All items should have required fields
      response.body.forEach((dept) => {
        expect(dept).toHaveProperty('id');
        expect(dept).toHaveProperty('name');
        expect(dept).toHaveProperty('createdAt');
      });
    });

    it('should not include deleted departments', async () => {
      // Create a department
      const createDto = {
        name: 'Temporary Department',
        description: 'To be deleted',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createDto)
        .expect(201);

      const deptId = createResponse.body.id;

      // Verify it's in the list
      let listResponse = await request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      let dept = listResponse.body.find((d) => d.id === deptId);
      expect(dept).toBeDefined();

      // Delete it
      await request(app.getHttpServer())
        .delete(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(204);

      // Verify it's no longer in the list
      listResponse = await request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      dept = listResponse.body.find((d) => d.id === deptId);
      expect(dept).toBeUndefined();
    });
  });

  describe('GET /api/departments/:id', () => {
    it('should return department by id', async () => {
      if (!createdDepartmentId) {
        // Create one if needed
        const createResponse = await request(app.getHttpServer())
          .post('/api/departments')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            name: 'Get Test Department',
            description: 'For testing GET by id',
          })
          .expect(201);

        createdDepartmentId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/departments/${createdDepartmentId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', createdDepartmentId);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for nonexistent id', async () => {
      await request(app.getHttpServer())
        .get('/api/departments/nonexistent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/departments/:id', () => {
    it('should update a department', async () => {
      if (!createdDepartmentId) {
        const createResponse = await request(app.getHttpServer())
          .post('/api/departments')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            name: 'Update Test Department',
            description: 'Initial description',
          })
          .expect(201);

        createdDepartmentId = createResponse.body.id;
      }

      const updateDto = {
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/departments/${createdDepartmentId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.description).toBe(updateDto.description);
    });
  });

  describe('DELETE /api/departments/:id', () => {
    it('should soft delete a department', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Delete Test Department',
          description: 'To be deleted',
        })
        .expect(201);

      const deptId = createResponse.body.id;

      // Delete it
      await request(app.getHttpServer())
        .delete(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(204);

      // Verify it's deleted (soft delete)
      const dept = await prisma.department.findFirst({
        where: { id: deptId },
      });

      expect(dept.deletedAt).not.toBeNull();
    });
  });
});
```

**Key patterns:**
- Real HTTP requests via supertest
- Real database operations
- Test complete workflows (create → read → update → delete)
- Cleanup after tests
- Test error cases (auth, validation, 404)
- Use real tokens from auth endpoint

### Phase 5: Testing Guards (JWT, CASL)

**Test JWT Access Guard:**

```typescript
// test/auth-guards.e2e-spec.ts
describe('JWT Access Guard (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  describe('Endpoints with @UseGuards(JwtAccessGuard)', () => {
    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/api/employees')
        .expect(401); // Unauthorized
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with expired token', async () => {
      // Create an expired token (depends on your token service)
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

      await request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', expiredToken)
        .expect(401);
    });

    it('should accept request with valid token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password' });

      const { accessToken } = loginResponse.body;

      await request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200); // Should succeed
    });
  });
});
```

**Test CASL Ability Guard:**

```typescript
// test/casl-guard.e2e-spec.ts
describe('CASL Ability Guard (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    // Get tokens for different roles
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password' });
    adminToken = adminLogin.body.accessToken;

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'employee@example.com', password: 'password' });
    employeeToken = employeeLogin.body.accessToken;
  });

  describe('Endpoints with @CheckAbility', () => {
    it('admin should be able to create employees', async () => {
      const createDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);
    });

    it('employee should not be able to create employees', async () => {
      const createDto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      };

      await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(createDto)
        .expect(403); // Forbidden
    });

    it('manager should only see employees in their branch', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Verify all employees have manager's branch
      response.body.forEach((employee) => {
        expect(employee.branchId).toBe(managerBranchId);
      });
    });
  });
});
```

### Phase 6: Testing Async Operations

**Test async service calls:**

```typescript
describe('Async Operations', () => {
  it('should handle concurrent requests', async () => {
    const promises = [
      service.create(createDto1, userId),
      service.create(createDto2, userId),
      service.create(createDto3, userId),
    ];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    expect(results[0]).toHaveProperty('id');
    expect(results[1]).toHaveProperty('id');
    expect(results[2]).toHaveProperty('id');
  });

  it('should handle errors in concurrent requests', async () => {
    jest
      .spyOn(prisma.department, 'create')
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(mockDepartment)
      .mockResolvedValueOnce(mockDepartment);

    const promises = [
      service.create(createDto1, userId),
      service.create(createDto2, userId),
      service.create(createDto3, userId),
    ];

    const results = await Promise.allSettled(promises);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(results[2].status).toBe('fulfilled');
  });
});
```

## Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| "Cannot find module" in tests | Jest can't resolve imports | Check `tsconfig.json` paths, verify `ts-jest` config |
| Mock not being used | spy created after module instantiation | Create mock in `beforeEach`, before service initialization |
| Prisma mock returning undefined | Mock not returning expected structure | Return object matching actual Prisma response (include relations) |
| Guard not being overridden | Override happens before module instantiation | Call `.overrideGuard()` before `.compile()` |
| Tests passing locally, failing in CI | Database state differs | Clean up after each test, use transactions, reset seed |
| Timeout errors in E2E tests | Database operations taking too long | Increase Jest timeout: `jest.setTimeout(30000)` |
| Token not valid in E2E tests | Login not returning valid token | Check auth module is working, verify test user exists in seed |

## Key Principles

1. **Isolation**: Unit tests mock everything, E2E tests use real dependencies
2. **Clarity**: Test names describe what's being tested and expected outcome
3. **Coverage**: Test happy path, error cases, and edge cases
4. **Cleanup**: Always cleanup test data (delete, reset, etc.)
5. **Determinism**: Tests should pass/fail consistently, not randomly
6. **Speed**: Unit tests <10ms each, E2E tests should complete in seconds
7. **Readability**: Use descriptive variable names, helper functions for common operations

## Quick Reference Commands

```bash
# Run unit tests
pnpm test

# Run with watch mode
pnpm test:watch

# Run specific test file
pnpm test department.service.spec.ts

# Run with coverage
pnpm test:cov

# Run E2E tests
pnpm test:e2e

# Run specific E2E file
pnpm test:e2e -- department.e2e-spec.ts
```

## See Also

- [AGENTS.md](../../../../AGENTS.md) — Project overview and testing patterns
- [crud-generation SKILL](../crud-generation/SKILL.md) — How to generate testable modules
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) — Official documentation
- [Jest Documentation](https://jestjs.io/) — Jest matcher reference
