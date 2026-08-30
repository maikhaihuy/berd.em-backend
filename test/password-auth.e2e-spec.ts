/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the make-password-login-primary change:
 * admin-settable password on user creation, self-service
 * forgot/reset-password (with the corrected token scoping), admin-assisted
 * reset-token issuance, and the authenticated Zalo-linking route.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('Password auth (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;

  let testUserId: number;
  const testUserPhone = `09098${Date.now() % 100000}`;
  const initialPassword = 'InitialPass123';

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

    const rolesRes = await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const roles = rolesRes.body as { id: number; name: string }[];
    const employeeRoleId = roles.find((r) => r.name === 'Employee')!.id;

    const userRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phoneNumber: testUserPhone,
        fullName: 'E2E Password Auth User',
        status: 'ACTIVE',
        roleIds: [employeeRoleId],
        password: initialPassword,
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
    await app.close();
  });

  it('has admin/employee tokens and a test user ready', () => {
    expect(adminToken).toBeDefined();
    expect(employeeToken).toBeDefined();
    expect(testUserId).toBeDefined();
  });

  describe('password set on user creation', () => {
    it('the created user can log in with the password given at creation', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testUserPhone, password: initialPassword })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
        });
    });

    it('the response never surfaces the password or its hash', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.password).toBeUndefined();
    });
  });

  describe('forgot-password / reset-password', () => {
    it('always responds 200 even for an unknown username (no existence leak)', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ username: '0900099999999' })
        .expect(200);
    });

    it('rejects reset-password with a garbage token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'not-a-real-token', newPassword: 'NewPass123' })
        .expect(401);
    });
  });

  describe('admin-assisted reset token issuance', () => {
    it('a non-admin cannot generate a reset token for another user', async () => {
      await request(app.getHttpServer())
        .post(`/users/${testUserId}/password-reset-token`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('an admin generates a token that completes a real password reset', async () => {
      const issueRes = await request(app.getHttpServer())
        .post(`/users/${testUserId}/password-reset-token`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const { token } = issueRes.body as { token: string; expiresAt: string };
      expect(token).toBeDefined();

      const newPassword = 'ResetPass456';
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testUserPhone, password: newPassword })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
        });

      // The old password no longer works.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testUserPhone, password: initialPassword })
        .expect(401);
    });

    it('a used reset token cannot be reused', async () => {
      const issueRes = await request(app.getHttpServer())
        .post(`/users/${testUserId}/password-reset-token`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const { token } = issueRes.body as { token: string };

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'AnotherPass789' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'YetAnotherPass000' })
        .expect(401);
    });
  });

  describe('authenticated Zalo linking', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/auth/link/zalo')
        .send({ accessToken: 'any-token' })
        .expect(401);
    });
  });
});
