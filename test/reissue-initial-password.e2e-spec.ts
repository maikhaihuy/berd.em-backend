/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@modules/prisma/prisma.service';

/**
 * End-to-end coverage for Admin re-issuance of an expired one-time
 * credential (`POST /users/:id/reissue-initial-password`) — see
 * openspec/changes/harden-initial-employee-password-provisioning.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('Admin re-issues an expired initial password (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let branchId: number;

  let testEmployeeId: number;
  let testUserId: number;
  let temporaryPassword: string;
  const testEmployeePhone = `09098${Date.now() % 100000}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    const admin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'settings', password: 'ChangeMe!123' });
    adminToken = admin.body.accessToken as string;

    const branchesRes = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${adminToken}`);
    const branches = branchesRes.body as { id: number }[];
    branchId = branches[0].id;

    const employeeRes = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'E2E Reissue Employee',
        phoneNumber: testEmployeePhone,
        branchIds: [branchId],
        primaryBranchId: branchId,
      })
      .expect(201);

    testEmployeeId = employeeRes.body.id as number;
    temporaryPassword = employeeRes.body.temporaryPassword as string;

    const employeeDetail = await request(app.getHttpServer())
      .get(`/employees/${testEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    testUserId = employeeDetail.body.user?.id as number;

    // Simulate the TTL having already elapsed, rather than waiting days.
    await prisma.user.update({
      where: { id: testUserId },
      data: { mustChangePasswordExpiresAt: new Date(Date.now() - 60_000) },
    });
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

  it('rejects login with the expired one-time credential', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testEmployeePhone, password: temporaryPassword })
      .expect(401);

    expect(res.body.details).toEqual(
      expect.objectContaining({ code: 'INITIAL_PASSWORD_EXPIRED' }),
    );
  });

  it('rejects the re-issue for a caller without the required permission', async () => {
    const devLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '0900000001', password: 'DevLogin!123' })
      .expect(200);
    const employeeToken = devLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .post(`/users/${testUserId}/reissue-initial-password`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('re-issues a fresh credential that supersedes the expired one', async () => {
    const reissueRes = await request(app.getHttpServer())
      .post(`/users/${testUserId}/reissue-initial-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const newPassword = reissueRes.body.password as string;
    expect(newPassword).toBeDefined();
    expect(newPassword).not.toBe(temporaryPassword);
    expect(reissueRes.body.expiresAt).toBeDefined();

    // The old (now-expired, now-overwritten) credential still doesn't work.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testEmployeePhone, password: temporaryPassword })
      .expect(401);

    // The freshly issued credential authenticates.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testEmployeePhone, password: newPassword })
      .expect(200);
    expect(login.body.accessToken).toBeDefined();
  });
});
