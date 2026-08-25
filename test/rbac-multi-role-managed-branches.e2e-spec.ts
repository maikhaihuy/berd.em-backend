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
});
