---
name: test-writing
description: 'Write comprehensive unit and E2E tests for NestJS services and controllers. Use when: adding test coverage, fixing failing tests, testing new features, ensuring the JWT/permission guards work. Patterns for mocking Prisma, overriding global guards, testing async operations.'
argument-hint: 'Ask "Write tests for the employee service" or "Add E2E tests for auth endpoints"'
---

# Test Writing Guide

Comprehensive patterns for writing unit and E2E tests in StaffHub following Jest + Supertest conventions.

## When to Use

- **New features**: Add test coverage before/after implementation (TDD)
- **Bug fixes**: Write tests that demonstrate the bug, then fix it
- **Refactoring**: Ensure tests pass before and after refactoring
- **Guard testing**: Verify `JwtAccessGuard` and `PermissionsGuard` work as expected
- **Database testing**: Mock Prisma for unit tests, real DB for E2E
- **Integration**: Test multiple services/controllers together
- **Coverage**: Aim for high coverage on critical paths

## Prerequisites

- Jest configured (unit tests: `package.json` `jest` block, `rootDir: src`, `*.spec.ts`; E2E: `test/jest-e2e.json`, `rootDir: .`, `*.e2e-spec.ts`)
- `@nestjs/testing` module available
- Supertest for E2E tests
- Understanding of Prisma mocking patterns
- A reachable Postgres database for E2E tests — there's no separate test-DB config, E2E tests run against whatever `DATABASE_URL` points at

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
- Use the real (dev) database
- Test real authentication flows (via `/api/auth/dev/login`, see Phase 5)
- Good for complete workflows, edge case scenarios

### Phase 2: Unit Test Pattern (Services)

**Setup and structure** — note `id`/`createdBy` are `number`, and there's no `deletedAt`:

```typescript
// department.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: PrismaService;

  const mockUser = { id: 1, phoneNumber: '0900000001' };

  const mockDepartment = {
    id: 1,
    name: 'Engineering',
    description: 'Building software',
    createdAt: new Date('2026-05-01'),
    createdBy: mockUser.id,
    updatedAt: new Date('2026-05-01'),
    updatedBy: mockUser.id,
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a department with createdBy/updatedBy', async () => {
      const createDto = { name: 'Engineering', description: 'Building software' };

      jest.spyOn(prisma.department, 'create').mockResolvedValue(mockDepartment);

      const result = await service.create(createDto, mockUser.id);

      expect(result).toEqual(expect.objectContaining({ id: 1, name: 'Engineering' }));
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { ...createDto, createdBy: mockUser.id, updatedBy: mockUser.id },
        include: expect.any(Object),
      });
    });

    it('should map a P2002 unique conflict to BadRequestException', async () => {
      const { Prisma } = await import('@prisma/client');
      jest.spyOn(prisma.department, 'create').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.13.0',
        }),
      );

      await expect(
        service.create({ name: 'dup' }, mockUser.id),
      ).rejects.toThrow('already in use');
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

    it('should return empty array if no departments exist', async () => {
      jest.spyOn(prisma.department, 'findMany').mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if department does not exist', async () => {
      jest.spyOn(prisma.department, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow('not found');
    });
  });

  describe('remove', () => {
    it('should hard-delete a department', async () => {
      jest.spyOn(prisma.department, 'delete').mockResolvedValue(mockDepartment);

      await service.remove(1);

      expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should map a P2025 not-found to NotFoundException', async () => {
      const { Prisma } = await import('@prisma/client');
      jest.spyOn(prisma.department, 'delete').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '6.13.0',
        }),
      );

      await expect(service.remove(999)).rejects.toThrow('not found');
    });
  });
});
```

**Key patterns:**

- Mock Prisma methods before testing
- Test happy path, `P2002`/`P2025` error-mapping, and edge cases
- Use `jest.clearAllMocks()` after each test
- Test the exact Prisma call arguments (`createdBy`/`updatedBy`, `include`, `orderBy`)
- `id`/`createdBy`/`updatedBy` are numbers — don't use string/UUID fixtures

### Phase 3: Unit Test Pattern (Controllers)

Controllers in this codebase do **not** carry `@UseGuards(JwtAccessGuard)` — both guards are registered globally in `AuthzModule`. A controller-level `TestingModule` (without booting the full app) simply never runs those guards, so there's usually nothing to override here; only override them when the `TestingModule` also imports `AppModule` or otherwise pulls in the global providers.

```typescript
// department.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';

describe('DepartmentController', () => {
  let controller: DepartmentController;
  let service: DepartmentService;

  const mockUser: AuthenticatedUserDto = {
    userId: 1,
    phone: '0900000001',
    role: 'Employee',
    branches: [1],
  };

  const mockDepartment = {
    id: 1,
    name: 'Engineering',
    description: 'Building software',
    createdAt: new Date('2026-05-01'),
    createdBy: mockUser.userId,
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
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DepartmentController>(DepartmentController);
    service = module.get<DepartmentService>(DepartmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return department response', async () => {
      const createDto = { name: 'Engineering', description: 'Building software' };

      jest.spyOn(service, 'create').mockResolvedValue(mockDepartment as any);

      const result = await controller.create(createDto, mockUser);

      expect(result).toHaveProperty('id', mockDepartment.id);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.userId);
    });
  });

  describe('findAll', () => {
    it('should return array of department responses', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockDepartment] as any);

      const result = await controller.findAll();

      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('id');
    });
  });

  describe('findOne', () => {
    it('should return department by id', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockDepartment as any);

      const result = await controller.findOne(1);

      expect(result).toHaveProperty('id', mockDepartment.id);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('remove', () => {
    it('should call service.remove with numeric id', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
```

**Key patterns:**

- Mock service methods only — no guard overriding needed unless the `TestingModule` boots real global providers
- Test controller logic (param parsing, passing `user.userId` through), not service logic
- `ParseIntPipe` isn't exercised by calling the controller method directly (it runs at the HTTP layer) — cover it in an E2E test if it matters

### Phase 4: E2E Test Pattern

**Full request/response cycle with the real database.** Both global guards run for real here, so get a token from `/api/auth/dev/login` (requires `AUTH_DEV_MODE=true`, `AUTH_DEV_SECRET` set, and `NODE_ENV !== 'production'` — see Phase 5) rather than overriding guards:

```typescript
// test/department.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Department E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let createdDepartmentId: number;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/dev/login')
      .set('x-dev-auth-secret', process.env.AUTH_DEV_SECRET ?? '')
      .send({ phone: process.env.DEV_EMPLOYEE_PHONE ?? '0900000001' });

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    if (createdDepartmentId) {
      await prisma.department.delete({ where: { id: createdDepartmentId } }).catch(() => undefined);
    }
    await app.close();
  });

  describe('POST /api/departments', () => {
    it('should create a department', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Engineering Department', description: 'Builds software' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Engineering Department');

      createdDepartmentId = response.body.id;
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/departments')
        .send({ name: 'Engineering' })
        .expect(401);
    });

    it('should fail with invalid input (validation)', async () => {
      await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('GET /api/departments', () => {
    it('should return list of departments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/departments')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('DELETE /api/departments/:id', () => {
    it('should hard-delete a department (not recoverable)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Temp Department' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/departments/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const found = await prisma.department.findUnique({ where: { id: created.body.id } });
      expect(found).toBeNull(); // real delete, not deletedAt
    });
  });
});
```

**Key patterns:**

- Real HTTP requests via supertest, real database operations
- Get tokens from `/api/auth/dev/login` (gated by env vars — skip/guard these tests if `AUTH_DEV_MODE` isn't set in CI)
- Test complete workflows (create → read → update → delete) and error cases (401 unauthenticated, 400 validation, 403 missing permission)
- Clean up created rows in `afterAll` — deletes are permanent, there's no `deletedAt` to reset

### Phase 5: Testing the Auth/Permission Guards

**`JwtAccessGuard`** rejects unauthenticated requests to any non-`@Public()` route:

```typescript
describe('JwtAccessGuard (E2E)', () => {
  it('should reject request without token', async () => {
    await request(app.getHttpServer()).get('/api/employees').expect(401);
  });

  it('should reject request with invalid token', async () => {
    await request(app.getHttpServer())
      .get('/api/employees')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
});
```

**`PermissionsGuard`** additionally rejects authenticated requests that lack the required `(action, subject)` grant — get tokens for two different roles (e.g. via two dev-login employees on different roles, seeded ahead of time) to exercise this:

```typescript
describe('PermissionsGuard (E2E)', () => {
  it('employee without the "create employees" permission gets 403', async () => {
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ fullName: 'Jane Doe', phoneNumber: '0900000002' })
      .expect(403);
  });

  it('admin with the permission succeeds', async () => {
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Jane Doe', phoneNumber: '0900000002' })
      .expect(201);
  });
});
```

There is no CASL ability system in this project — `src/modules/casl/casl-ability.factory.ts` is commented-out dead code and `CaslModule` isn't imported anywhere. Don't write tests against it.

### Phase 6: Testing Async Operations

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
    results.forEach((r) => expect(r).toHaveProperty('id'));
  });

  it('should handle partial failures in concurrent requests', async () => {
    jest
      .spyOn(prisma.department, 'create')
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(mockDepartment)
      .mockResolvedValueOnce(mockDepartment);

    const results = await Promise.allSettled([
      service.create(createDto1, userId),
      service.create(createDto2, userId),
      service.create(createDto3, userId),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(results[2].status).toBe('fulfilled');
  });
});
```

## Troubleshooting Guide

| Issue                                 | Cause                                          | Solution                                                            |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| "Cannot find module" in tests          | Jest can't resolve `@modules/*`/`@common/*`       | Check `moduleNameMapper` in `package.json` jest config matches `tsconfig.json` paths |
| Mock not being used                    | Spy created after module instantiation            | Create mock in `beforeEach`, before service initialization                |
| Prisma mock returning undefined        | Mock not returning expected structure             | Return an object matching the actual Prisma response (with relations)     |
| E2E route always 401/403 unexpectedly  | Both guards are global — a route without `@Public()`/`@SkipPermissions()`/`@RequirePermissions()` denies by default | Confirm the route declares the right decorator combination |
| Tests passing locally, failing in CI   | Database state differs, or `AUTH_DEV_MODE` unset in CI | Clean up after each test; guard dev-login-dependent E2E specs behind an env check |
| Timeout errors in E2E tests            | Database operations taking too long               | Increase Jest timeout: `jest.setTimeout(30000)`                           |
| Token not valid in E2E tests           | Dev login disabled or wrong `x-dev-auth-secret`   | Verify `AUTH_DEV_MODE=true`, `AUTH_DEV_SECRET` set, `NODE_ENV !== 'production'`, header matches |

## Key Principles

1. **Isolation**: Unit tests mock everything, E2E tests use real dependencies
2. **Clarity**: Test names describe what's being tested and expected outcome
3. **Coverage**: Test happy path, `P2002`/`P2025` error-mapping, and permission-denied cases
4. **Cleanup**: Always clean up test data — deletes are permanent (no `deletedAt` to reset)
5. **Determinism**: Tests should pass/fail consistently, not randomly
6. **Speed**: Unit tests should run in milliseconds; E2E tests should complete in seconds
7. **Real ids**: `id`, `createdBy`, `updatedBy` are `number` — don't fixture them as UUID strings

## Quick Reference Commands

```bash
# Run unit tests
pnpm test

# Run with watch mode
pnpm test:watch

# Run specific test file
pnpm test department.service.spec

# Run with coverage
pnpm test:cov

# Run E2E tests
pnpm test:e2e

# Run specific E2E file
pnpm test:e2e -- department.e2e-spec.ts
```

## See Also

- [AGENTS.md](../../../AGENTS.md) — Project overview, auth/authorization model
- [crud-generation SKILL](../crud-generation/SKILL.md) — How to generate testable modules
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) — Official documentation
- [Jest Documentation](https://jestjs.io/) — Jest matcher reference
