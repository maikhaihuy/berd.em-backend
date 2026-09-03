/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for auto-provisioning a User when an Employee is
 * created, and for the forced-password-change gate that follows.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */

/** Decodes a JWT's payload segment without verifying its signature. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payloadSegment = token.split('.')[1];
  const json = Buffer.from(payloadSegment, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

describe('Auto-provision User on Employee create (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let branchId: number;

  let testEmployeeId: number;
  let testUserId: number;
  let temporaryPassword: string;
  let employeeToken: string;
  const testEmployeePhone = `09099${Date.now() % 100000}`;

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

    const branchesRes = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${adminToken}`);
    const branches = branchesRes.body as { id: number }[];
    branchId = branches[0].id;
  }, 30000);

  afterAll(async () => {
    if (testEmployeeId) {
      await request(app.getHttpServer())
        .delete(`/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    if (testUserId) {
      await request(app.getHttpServer())
        .delete(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    await app.close();
  });

  it('has an admin token and a branch ready', () => {
    expect(adminToken).toBeDefined();
    expect(branchId).toBeDefined();
  });

  describe('Employee creation auto-provisions a User', () => {
    it('creates the Employee and a matching User the Employee can log in as', async () => {
      const employeeRes = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'E2E Auto-Provision Employee',
          phoneNumber: testEmployeePhone,
          branchIds: [branchId],
          primaryBranchId: branchId,
        })
        .expect(201);

      testEmployeeId = employeeRes.body.id as number;
      expect(testEmployeeId).toBeDefined();
      temporaryPassword = employeeRes.body.temporaryPassword as string;
      expect(temporaryPassword).toBeDefined();
      expect(temporaryPassword).not.toBe(testEmployeePhone);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testEmployeePhone,
          password: temporaryPassword,
        })
        .expect(200);

      expect(login.body.accessToken).toBeDefined();
      employeeToken = login.body.accessToken as string;

      // The freshly issued access token flags the caller as needing a
      // password change.
      const decodedLoginToken = decodeJwtPayload(employeeToken);
      expect(decodedLoginToken.mustChangePassword).toBe(true);

      // A refreshed access token still carries the (still-true) flag.
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken as string })
        .expect(200);
      const decodedRefreshedToken = decodeJwtPayload(
        refreshRes.body.accessToken as string,
      );
      expect(decodedRefreshedToken.mustChangePassword).toBe(true);

      // The phone number itself is no longer a valid password.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testEmployeePhone, password: testEmployeePhone })
        .expect(401);

      const employeeDetail = await request(app.getHttpServer())
        .get(`/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      testUserId = employeeDetail.body.user?.id as number;
      expect(testUserId).toBeDefined();
      // The one-time credential is never echoed back on GET.
      expect(employeeDetail.body.temporaryPassword).toBeUndefined();
    });

    it('rejects creating a second Employee with a phone number that already belongs to a User', async () => {
      await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Should Not Be Created',
          phoneNumber: testEmployeePhone,
          branchIds: [branchId],
          primaryBranchId: branchId,
        })
        .expect(400);
    });
  });

  describe('forced password change', () => {
    it('blocks a non-exempt authenticated route with PASSWORD_CHANGE_REQUIRED', async () => {
      const res = await request(app.getHttpServer())
        .get('/me/abilities')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      expect(res.body.details).toEqual(
        expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }),
      );
    });

    it('rejects change-password with the wrong current password', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          currentPassword: 'definitely-wrong',
          newPassword: 'NewEmployeePass123',
        })
        .expect(401);
    });

    it('changes the password and clears the flag, unblocking other routes', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'NewEmployeePass123',
        })
        .expect(200);

      await request(app.getHttpServer())
        .get('/me/abilities')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      // Old one-time credential no longer works.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testEmployeePhone, password: temporaryPassword })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testEmployeePhone,
          password: 'NewEmployeePass123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          // The flag is cleared, so a fresh login token reflects that.
          const decoded = decodeJwtPayload(res.body.accessToken as string);
          expect(decoded.mustChangePassword).toBe(false);
        });
    });
  });
});
