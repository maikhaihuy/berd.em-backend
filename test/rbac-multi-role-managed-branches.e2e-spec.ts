/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the rbac-multi-role-managed-branches change:
 * multi-role assignment (POST/DELETE /users/:id/roles), managed-branch
 * assignment (POST/DELETE /users/:id/manager-branches), and the
 * `$managedBranches` condition token, exercised via the real
 * GET /users/:id/abilities introspection endpoint so no separate login flow
 * is needed for the freshly created test user.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('RBAC multi-role & managed branches (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;

  let roleAId: number;
  let roleBId: number;
  let roleCId: number;
  let branchId: number;
  let testUserId: number;

  let readBranchesPermissionId: number;
  let readHourlyRatesPermissionId: number;
  let readMasterShiftsPermissionId: number;

  interface AbilityRule {
    action: string;
    subject: string;
    conditions?: Record<string, unknown>;
  }

  const findRule = (rules: AbilityRule[], subject: string) =>
    rules.find((r) => r.subject === subject && r.action === 'read');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'settings', password: 'ChangeMe!123' });
    adminToken = admin.body.accessToken as string;

    const employee = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '0900000001', password: 'DevLogin!123' });
    employeeToken = employee.body.accessToken as string;

    const permissionsRes = await request(app.getHttpServer())
      .get('/permissions')
      .set('Authorization', `Bearer ${adminToken}`);
    const permissions = permissionsRes.body as {
      id: number;
      action: string;
      subject: string;
    }[];
    readBranchesPermissionId = permissions.find(
      (p) => p.action === 'read' && p.subject === 'branches',
    )!.id;
    readHourlyRatesPermissionId = permissions.find(
      (p) => p.action === 'read' && p.subject === 'employee-hourly-rates',
    )!.id;
    readMasterShiftsPermissionId = permissions.find(
      (p) => p.action === 'read' && p.subject === 'master-shifts',
    )!.id;

    const roleARes = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E MultiRole A ${Date.now()}`,
        permissionIds: [readBranchesPermissionId],
      });
    roleAId = roleARes.body.id as number;

    const roleBRes = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E MultiRole B ${Date.now()}`,
        permissionIds: [readHourlyRatesPermissionId],
      });
    roleBId = roleBRes.body.id as number;

    const roleCRes = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E ManagedBranches C ${Date.now()}`,
        permissionIds: [readMasterShiftsPermissionId],
      });
    roleCId = roleCRes.body.id as number;

    await request(app.getHttpServer())
      .post('/role-permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleId: roleCId,
        grants: [
          {
            permissionId: readMasterShiftsPermissionId,
            condition: { branchId: { in: '$managedBranches' } },
          },
        ],
      })
      .expect(201);

    const branchRes = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Managed Branch ${Date.now()}`,
        abbreviation: `MB${Date.now() % 10000}`,
        address: '123 Test St',
      });
    branchId = branchRes.body.id as number;

    const userRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phoneNumber: `09099${Date.now() % 100000}`,
        fullName: 'E2E Multi Role User',
        status: 'ACTIVE',
        roleIds: [roleAId],
      });
    testUserId = userRes.body.id as number;
  }, 30000);

  afterAll(async () => {
    if (testUserId) {
      await request(app.getHttpServer())
        .delete(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    if (branchId) {
      await request(app.getHttpServer())
        .delete(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    for (const roleId of [roleAId, roleBId, roleCId]) {
      if (roleId) {
        await request(app.getHttpServer())
          .delete(`/roles/${roleId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .catch(() => {});
      }
    }
    await app.close();
  });

  it('has admin/employee tokens and fixtures ready', () => {
    expect(adminToken).toBeDefined();
    expect(employeeToken).toBeDefined();
    expect(testUserId).toBeDefined();
    expect(branchId).toBeDefined();
  });

  describe('multi-role assignment', () => {
    it('a single-role user only carries that role’s grant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      expect(findRule(rules, 'branches')).toBeDefined();
      expect(findRule(rules, 'employee-hourly-rates')).toBeUndefined();
    });

    it('POST /users/:id/roles adds a second role; abilities become the union of both', async () => {
      await request(app.getHttpServer())
        .post(`/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleIds: [roleBId] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      expect(findRule(rules, 'branches')).toBeDefined();
      expect(findRule(rules, 'employee-hourly-rates')).toBeDefined();
    });

    it('DELETE /users/:id/roles/:roleId removes one role, the other remains', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${testUserId}/roles/${roleAId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      expect(findRule(rules, 'branches')).toBeUndefined();
      expect(findRule(rules, 'employee-hourly-rates')).toBeDefined();
    });

    it('rejects removing the user’s last remaining role', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${testUserId}/roles/${roleBId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('a non-admin cannot assign roles', async () => {
      await request(app.getHttpServer())
        .post(`/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ roleIds: [roleAId] })
        .expect(403);
    });
  });

  describe('managed-branch scoping ($managedBranches)', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post(`/users/${testUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleIds: [roleCId] })
        .expect(201);
    });

    it('resolves to an empty list (not an error) when the user manages no branches', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      const rule = findRule(rules, 'master-shifts');
      expect(rule).toBeDefined();
      expect(rule?.conditions).toEqual({ branchId: { in: [] } });
    });

    it('POST /users/:id/manager-branches resolves branchId to the assigned branch', async () => {
      await request(app.getHttpServer())
        .post(`/users/${testUserId}/manager-branches`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ branchIds: [branchId] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      const rule = findRule(rules, 'master-shifts');
      expect(rule?.conditions).toEqual({ branchId: { in: [branchId] } });
    });

    it('DELETE /users/:id/manager-branches/:branchId reverts to an empty list', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${testUserId}/manager-branches/${branchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      const rule = findRule(rules, 'master-shifts');
      expect(rule?.conditions).toEqual({ branchId: { in: [] } });
    });

    it('a non-admin cannot assign managed branches', async () => {
      await request(app.getHttpServer())
        .post(`/users/${testUserId}/manager-branches`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ branchIds: [branchId] })
        .expect(403);
    });
  });

  describe('seeded Manager role scopes to $managedBranches', () => {
    let managerRoleId: number;
    let managerUserId: number;

    beforeAll(async () => {
      const rolesRes = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const roles = rolesRes.body as { id: number; name: string }[];
      managerRoleId = roles.find((r) => r.name === 'Manager')!.id;

      const userRes = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phoneNumber: `09097${Date.now() % 100000}`,
          fullName: 'E2E Seeded Manager User',
          status: 'ACTIVE',
          roleIds: [managerRoleId],
        })
        .expect(201);
      managerUserId = userRes.body.id as number;
    }, 30000);

    afterAll(async () => {
      if (managerUserId) {
        await request(app.getHttpServer())
          .delete(`/users/${managerUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .catch(() => {});
      }
    });

    it('resolves master-shifts and employees to an empty list when the manager manages no branches', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${managerUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      expect(findRule(rules, 'master-shifts')?.conditions).toEqual({
        branchId: { in: [] },
      });
      expect(findRule(rules, 'employees')?.conditions).toEqual({
        employeeBranches: { some: { branchId: { in: [] } } },
      });
      // sub-shifts/tasks have no direct branchId, scoped via their parent
      // master shift (and, for tasks, optionally via their sub shift).
      expect(findRule(rules, 'sub-shifts')?.conditions).toEqual({
        masterShift: { is: { branchId: { in: [] } } },
      });
      expect(findRule(rules, 'tasks')?.conditions).toEqual({
        OR: [
          { masterShift: { is: { branchId: { in: [] } } } },
          {
            subShift: {
              is: { masterShift: { is: { branchId: { in: [] } } } },
            },
          },
        ],
      });
    });

    it('scopes master-shifts and employees to the assigned branch once managed', async () => {
      await request(app.getHttpServer())
        .post(`/users/${managerUserId}/manager-branches`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ branchIds: [branchId] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/users/${managerUserId}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as AbilityRule[];
      expect(findRule(rules, 'master-shifts')?.conditions).toEqual({
        branchId: { in: [branchId] },
      });
      expect(findRule(rules, 'employees')?.conditions).toEqual({
        employeeBranches: { some: { branchId: { in: [branchId] } } },
      });
      expect(findRule(rules, 'sub-shifts')?.conditions).toEqual({
        masterShift: { is: { branchId: { in: [branchId] } } },
      });
      expect(findRule(rules, 'tasks')?.conditions).toEqual({
        OR: [
          { masterShift: { is: { branchId: { in: [branchId] } } } },
          {
            subShift: {
              is: { masterShift: { is: { branchId: { in: [branchId] } } } },
            },
          },
        ],
      });

      await request(app.getHttpServer())
        .delete(`/users/${managerUserId}/manager-branches/${branchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('seeded Manager role filters sub-shifts/tasks by managed branch', () => {
    let managerRoleId: number;
    let managerUserId: number;
    let managerToken: string;
    let managedBranchId: number;
    let otherBranchId: number;
    let managedMasterShiftId: number;
    let otherMasterShiftId: number;
    let managedSubShiftId: number;
    let otherSubShiftId: number;
    let managedSharedTaskId: number;
    let managedDedicatedTaskId: number;
    let otherSharedTaskId: number;
    let otherDedicatedTaskId: number;

    beforeAll(async () => {
      const rolesRes = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const roles = rolesRes.body as { id: number; name: string }[];
      managerRoleId = roles.find((r) => r.name === 'Manager')!.id;

      const managerPassword = 'E2EManagerPass!123';
      const managerUserRes = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phoneNumber: `09096${Date.now() % 100000}`,
          fullName: 'E2E Sub-Shift/Task Manager',
          status: 'ACTIVE',
          roleIds: [managerRoleId],
          password: managerPassword,
        })
        .expect(201);
      managerUserId = managerUserRes.body.id as number;

      const managerLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: managerUserRes.body.phoneNumber as string,
          password: managerPassword,
        })
        .expect(200);
      managerToken = managerLogin.body.accessToken as string;

      const managedBranchRes = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Managed Sub/Task Branch ${Date.now()}`,
          abbreviation: `MS${Date.now() % 10000}`,
          address: '1 Managed St',
        })
        .expect(201);
      managedBranchId = managedBranchRes.body.id as number;

      const otherBranchRes = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Other Sub/Task Branch ${Date.now()}`,
          abbreviation: `OT${Date.now() % 10000}`,
          address: '2 Other St',
        })
        .expect(201);
      otherBranchId = otherBranchRes.body.id as number;

      await request(app.getHttpServer())
        .post(`/users/${managerUserId}/manager-branches`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ branchIds: [managedBranchId] })
        .expect(201);

      const buildMasterShift = async (branch: number, title: string) => {
        const res = await request(app.getHttpServer())
          .post('/master-shifts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            branchId: branch,
            workDate: '2026-09-10',
            title,
            startTime: '2026-09-10T08:00:00.000Z',
            endTime: '2026-09-10T17:00:00.000Z',
          })
          .expect(201);
        return res.body.id as number;
      };
      managedMasterShiftId = await buildMasterShift(
        managedBranchId,
        `Managed Master ${Date.now()}`,
      );
      otherMasterShiftId = await buildMasterShift(
        otherBranchId,
        `Other Master ${Date.now()}`,
      );

      const buildSubShift = async (masterShiftId: number) => {
        const res = await request(app.getHttpServer())
          .post('/sub-shifts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            masterShiftId,
            title: 'Morning Sub',
            type: 'MAIN',
            startTime: '2026-09-10T08:00:00.000Z',
            endTime: '2026-09-10T12:00:00.000Z',
          })
          .expect(201);
        return res.body.id as number;
      };
      managedSubShiftId = await buildSubShift(managedMasterShiftId);
      otherSubShiftId = await buildSubShift(otherMasterShiftId);

      const buildTask = async (
        parent: { masterShiftId?: number; subShiftId?: number },
        type: 'SHARED_MANDATORY' | 'DEDICATED',
      ) => {
        const res = await request(app.getHttpServer())
          .post('/tasks')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...parent, title: `${type} task`, type })
          .expect(201);
        return res.body.id as number;
      };
      managedSharedTaskId = await buildTask(
        { masterShiftId: managedMasterShiftId },
        'SHARED_MANDATORY',
      );
      managedDedicatedTaskId = await buildTask(
        { subShiftId: managedSubShiftId },
        'DEDICATED',
      );
      otherSharedTaskId = await buildTask(
        { masterShiftId: otherMasterShiftId },
        'SHARED_MANDATORY',
      );
      otherDedicatedTaskId = await buildTask(
        { subShiftId: otherSubShiftId },
        'DEDICATED',
      );
    }, 30000);

    afterAll(async () => {
      for (const id of [
        managedSharedTaskId,
        managedDedicatedTaskId,
        otherSharedTaskId,
        otherDedicatedTaskId,
      ]) {
        if (id) {
          await request(app.getHttpServer())
            .delete(`/tasks/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .catch(() => {});
        }
      }
      for (const id of [managedSubShiftId, otherSubShiftId]) {
        if (id) {
          await request(app.getHttpServer())
            .delete(`/sub-shifts/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .catch(() => {});
        }
      }
      for (const id of [managedMasterShiftId, otherMasterShiftId]) {
        if (id) {
          await request(app.getHttpServer())
            .delete(`/master-shifts/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .catch(() => {});
        }
      }
      if (managerUserId) {
        await request(app.getHttpServer())
          .delete(`/users/${managerUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .catch(() => {});
      }
      for (const id of [managedBranchId, otherBranchId]) {
        if (id) {
          await request(app.getHttpServer())
            .delete(`/branches/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .catch(() => {});
        }
      }
    });

    it('lists only the managed-branch sub-shift', async () => {
      const res = await request(app.getHttpServer())
        .get('/sub-shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const ids = (res.body as { id: number }[]).map((s) => s.id);
      expect(ids).toContain(managedSubShiftId);
      expect(ids).not.toContain(otherSubShiftId);
    });

    it('excludes the unmanaged-branch sub-shift by id (404)', async () => {
      await request(app.getHttpServer())
        .get(`/sub-shifts/${otherSubShiftId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);
    });

    it('lists both managed-branch tasks (shared and dedicated) and excludes the unmanaged ones', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const ids = (res.body as { id: number }[]).map((t) => t.id);
      expect(ids).toContain(managedSharedTaskId);
      expect(ids).toContain(managedDedicatedTaskId);
      expect(ids).not.toContain(otherSharedTaskId);
      expect(ids).not.toContain(otherDedicatedTaskId);
    });

    it('excludes the unmanaged-branch tasks by id (404)', async () => {
      await request(app.getHttpServer())
        .get(`/tasks/${otherSharedTaskId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/tasks/${otherDedicatedTaskId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);
    });

    it('returns an empty list (not 403) for sub-shifts and tasks once the manager has no managed branches', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${managerUserId}/manager-branches/${managedBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const subShiftsRes = await request(app.getHttpServer())
        .get('/sub-shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(subShiftsRes.body).toEqual([]);

      const tasksRes = await request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(tasksRes.body).toEqual([]);

      await request(app.getHttpServer())
        .post(`/users/${managerUserId}/manager-branches`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ branchIds: [managedBranchId] })
        .expect(201);
    });
  });
});
