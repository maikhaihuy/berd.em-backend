/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the `employees` CRUD surface as its own subject —
 * previously only exercised incidentally as fixture setup inside other e2e
 * specs. Covers full CRUD plus the auto-provisioned User/temporaryPassword
 * response (see `CLAUDE.md`'s Auth flows) and duplicate-phone rejection.
 * Requires a seeded DB with the Admin `settings` user.
 */
describe('Employees (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let branchAId: number;
  let branchBId: number;
  let employeeId: number;

  const suffix = Date.now().toString().slice(-6);
  const phoneNumber = `0901${suffix}`;

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

    const branchA = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Employee Branch A ${suffix}`,
        abbreviation: `EA${suffix}`.slice(0, 10),
        address: '1 Test Ave',
      });
    branchAId = branchA.body.id as number;

    const branchB = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Employee Branch B ${suffix}`,
        abbreviation: `EB${suffix}`.slice(0, 10),
        address: '2 Other Ave',
      });
    branchBId = branchB.body.id as number;
  }, 30000);

  afterAll(async () => {
    if (employeeId) {
      await request(app.getHttpServer())
        .delete(`/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    for (const id of [branchAId, branchBId]) {
      if (id) {
        await request(app.getHttpServer())
          .delete(`/branches/${id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .catch(() => {});
      }
    }
    await app.close();
  });

  it('creates an employee, auto-provisioning a User with a one-time password', async () => {
    const res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'E2E Test Employee',
        phoneNumber,
        branchIds: [branchAId],
        primaryBranchId: branchAId,
      })
      .expect(201);

    expect(res.body.phoneNumber).toBe(phoneNumber);
    expect(typeof res.body.temporaryPassword).toBe('string');
    expect(res.body.temporaryPassword.length).toBeGreaterThan(0);
    employeeId = res.body.id as number;
  });

  it('rejects creating a second employee with the same phone number (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Duplicate Phone Employee',
        phoneNumber,
        branchIds: [branchAId],
      })
      .expect(400);
    expect(res.body.errors?.[0]?.field ?? res.body.message).toBeDefined();
  });

  it('lists employees, including the one just created', async () => {
    const res = await request(app.getHttpServer())
      .get('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ids = (res.body as { id: number }[]).map((e) => e.id);
    expect(ids).toContain(employeeId);
  });

  it('fetches an employee by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(employeeId);
    expect(res.body.temporaryPassword).toBeUndefined();
  });

  it('returns 404 fetching a non-existent employee', async () => {
    await request(app.getHttpServer())
      .get('/employees/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('updates an employee, reassigning its branch', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'E2E Test Employee Updated', branchIds: [branchBId] })
      .expect(200);
    expect(res.body.fullName).toBe('E2E Test Employee Updated');
    expect(res.body.branches).toEqual([
      expect.objectContaining({ id: branchBId }),
    ]);
  });

  it('returns 404 updating a non-existent employee', async () => {
    await request(app.getHttpServer())
      .patch('/employees/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'nobody' })
      .expect(404);
  });

  it('deletes an employee', async () => {
    await request(app.getHttpServer())
      .delete(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    employeeId = 0;
  });

  it('returns 404 deleting a non-existent employee', async () => {
    await request(app.getHttpServer())
      .delete('/employees/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  describe('self-service PATCH /employees/me', () => {
    let selfServiceEmployeeId: number;
    let selfServiceToken: string;
    const selfServicePhone = `0902${suffix}`;

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'E2E Self Service Employee',
          phoneNumber: selfServicePhone,
          branchIds: [branchAId],
          primaryBranchId: branchAId,
        })
        .expect(201);
      selfServiceEmployeeId = created.body.id as number;
      const temporaryPassword = created.body.temporaryPassword as string;

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: selfServicePhone, password: temporaryPassword })
        .expect(200);
      const bootstrapToken = login.body.accessToken as string;

      // Auto-provisioned accounts carry mustChangePassword: true, which blocks
      // every route except @Public()/@AllowWhilePasswordChangeRequired() ones
      // (see CLAUDE.md's Forced password change) — clear it so PATCH
      // /employees/me (neither) is reachable, same as any real onboarded user.
      const newPassword = 'E2ESelfService!123';
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${bootstrapToken}`)
        .send({ currentPassword: temporaryPassword, newPassword })
        .expect(200);

      const relogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: selfServicePhone, password: newPassword })
        .expect(200);
      selfServiceToken = relogin.body.accessToken as string;
    }, 30000);

    afterAll(async () => {
      if (selfServiceEmployeeId) {
        await request(app.getHttpServer())
          .delete(`/employees/${selfServiceEmployeeId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .catch(() => {});
      }
    });

    it('lets a Staff-role caller (no update:employees) update their own contact info', async () => {
      const res = await request(app.getHttpServer())
        .patch('/employees/me')
        .set('Authorization', `Bearer ${selfServiceToken}`)
        .send({ email: 'e2e-self-service@example.com', address: '42 Self St' })
        .expect(200);

      expect(res.body.id).toBe(selfServiceEmployeeId);
      expect(res.body.email).toBe('e2e-self-service@example.com');
      expect(res.body.address).toBe('42 Self St');
    });

    it('rejects a field outside the phoneNumber/email/address whitelist (400)', async () => {
      await request(app.getHttpServer())
        .patch('/employees/me')
        .set('Authorization', `Bearer ${selfServiceToken}`)
        .send({ fullName: 'Hacked Name' })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/employees/me')
        .set('Authorization', `Bearer ${selfServiceToken}`)
        .send({ branchIds: [branchBId] })
        .expect(400);

      // Neither rejected request modified the record.
      const res = await request(app.getHttpServer())
        .get(`/employees/${selfServiceEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.fullName).toBe('E2E Self Service Employee');
      expect(res.body.branches).toEqual([
        expect.objectContaining({ id: branchAId }),
      ]);
    });

    it('rejects an admin caller with no linked employee (403)', async () => {
      await request(app.getHttpServer())
        .patch('/employees/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'admin-has-no-employee@example.com' })
        .expect(403);
    });
  });
});
