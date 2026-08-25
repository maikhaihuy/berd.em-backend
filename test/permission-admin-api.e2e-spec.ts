/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the permission-admin-api-support change: the
 * PATCH /roles/:id fix, isSystemRole protection, role-permission condition
 * assignment, and (added incrementally as later tasks land) the abilities
 * and audit-log endpoints.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('Permission admin API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let createdRoleId: number;
  let readTimeLogsPermissionId: number;
  let createTimeLogsPermissionId: number;

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
    readTimeLogsPermissionId = permissions.find(
      (p) => p.action === 'read' && p.subject === 'time-logs',
    )!.id;
    createTimeLogsPermissionId = permissions.find(
      (p) => p.action === 'create' && p.subject === 'time-logs',
    )!.id;

    const roleRes = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Role ${Date.now()}`,
        permissionIds: [readTimeLogsPermissionId],
      });
    createdRoleId = roleRes.body.id as number;
  }, 30000);

  afterAll(async () => {
    if (createdRoleId) {
      await request(app.getHttpServer())
        .delete(`/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    await app.close();
  });

  it('logs in Admin and has a test role/permissions ready', () => {
    expect(adminToken).toBeDefined();
    expect(createdRoleId).toBeDefined();
    expect(readTimeLogsPermissionId).toBeDefined();
    expect(createTimeLogsPermissionId).toBeDefined();
  });

  describe('PATCH /roles/:id', () => {
    it('rejects a permissionIds field with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'renamed', permissionIds: [1] })
        .expect(400);
    });

    it('still updates name/description without permissionIds', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/roles/${createdRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'updated via e2e' })
        .expect(200);

      expect(res.body.description).toBe('updated via e2e');
    });
  });

  describe('Role.isSystemRole', () => {
    it('rejects deleting a seeded system role', async () => {
      const rolesRes = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const roles = rolesRes.body as {
        id: number;
        name: string;
        isSystemRole: boolean;
      }[];
      const manager = roles.find((r) => r.name === 'Manager');
      expect(manager?.isSystemRole).toBe(true);

      await request(app.getHttpServer())
        .delete(`/roles/${manager!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('allows deleting a freshly created (non-system) role', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Disposable Role ${Date.now()}`,
          permissionIds: [readTimeLogsPermissionId],
        })
        .expect(201);
      expect(createRes.body.isSystemRole).toBe(false);

      await request(app.getHttpServer())
        .delete(`/roles/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });

  describe('POST /role-permissions with condition', () => {
    it('assigns a grant with a condition and round-trips it via list', async () => {
      await request(app.getHttpServer())
        .post('/role-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: createdRoleId,
          grants: [
            {
              permissionId: readTimeLogsPermissionId,
              condition: { employeeId: '$self' },
            },
          ],
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get(`/role-permissions/role/${createdRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const grant = (
        list.body as { permissionId: number; condition: unknown }[]
      ).find((g) => g.permissionId === readTimeLogsPermissionId);
      expect(grant?.condition).toEqual({ employeeId: '$self' });
    });

    it('a second, narrower assignment leaves the earlier grant untouched (additive)', async () => {
      await request(app.getHttpServer())
        .post('/role-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: createdRoleId,
          grants: [{ permissionId: createTimeLogsPermissionId }],
        })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get(`/role-permissions/role/${createdRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const permissionIds = (list.body as { permissionId: number }[]).map(
        (g) => g.permissionId,
      );
      expect(permissionIds).toEqual(
        expect.arrayContaining([
          readTimeLogsPermissionId,
          createTimeLogsPermissionId,
        ]),
      );
    });
  });

  describe('GET /audit-logs', () => {
    it('rejects a non-admin caller with 403', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('returns rows for an admin, newest first, filterable by subject', async () => {
      // The role-permission assignments above already generated
      // audit rows for subject "role-permissions".
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .query({ subject: 'role-permissions', limit: 20 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rows = res.body as {
        subject: string;
        createdAt: string;
      }[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.subject === 'role-permissions')).toBe(true);

      const timestamps = rows.map((r) => new Date(r.createdAt).getTime());
      const sorted = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sorted);
    });
  });

  describe('GET /me/abilities', () => {
    it('returns 200 with resolved rules for any authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/me/abilities')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const rules = res.body as { action: string; subject: string }[];
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
      expect(
        rules.every(
          (r) => typeof r.action === 'string' && typeof r.subject === 'string',
        ),
      ).toBe(true);
    });
  });

  describe('GET /users/:id/abilities', () => {
    it('rejects a non-admin caller with 403', async () => {
      await request(app.getHttpServer())
        .get('/users/1/abilities')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('returns the resolved rule set for a known seeded user as admin', async () => {
      const usersRes = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const devEmployeeUser = (
        usersRes.body as { id: number; phoneNumber: string }[]
      ).find((u) => u.phoneNumber === '0900000001');
      expect(devEmployeeUser).toBeDefined();

      const res = await request(app.getHttpServer())
        .get(`/users/${devEmployeeUser!.id}/abilities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const rules = res.body as { action: string; subject: string }[];
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('returns 404 for a non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/users/999999999/abilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
