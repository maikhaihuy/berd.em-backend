/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage of the payroll surface through the full app (global JWT +
 * PermissionsGuard active). Requires DATABASE_URL to point at a reachable,
 * seeded database (the Admin `settings` user and the dev Employee).
 */
describe('Payroll (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let createdPayPeriodId: number;

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
  });

  afterAll(async () => {
    if (createdPayPeriodId) {
      await request(app.getHttpServer())
        .delete(`/pay-periods/${createdPayPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('logs in Admin and Employee', () => {
    expect(adminToken).toBeDefined();
    expect(employeeToken).toBeDefined();
  });

  it('denies a non-admin (Employee) access to pay-periods (403)', async () => {
    await request(app.getHttpServer())
      .get('/pay-periods')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('Admin creates a pay period with status OPEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/pay-periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-15T23:59:59.999Z',
        notes: 'e2e test period',
      })
      .expect(201);

    expect(res.body.status).toBe('OPEN');
    createdPayPeriodId = res.body.id as number;
  });

  it('generates payroll entries (no eligible verified time logs -> empty result)', async () => {
    const res = await request(app.getHttpServer())
      .post('/payroll-entries/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payPeriodId: createdPayPeriodId })
      .expect(201);

    expect(res.body).toHaveProperty('created');
    expect(res.body).toHaveProperty('skipped');
    expect(Array.isArray(res.body.created)).toBe(true);
  });

  it('rejects finalize on an OPEN pay period (400)', async () => {
    await request(app.getHttpServer())
      .post(`/pay-periods/${createdPayPeriodId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('walks the lifecycle OPEN -> CLOSED -> FINALIZED', async () => {
    const closed = await request(app.getHttpServer())
      .post(`/pay-periods/${createdPayPeriodId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(closed.body.status).toBe('CLOSED');

    const finalized = await request(app.getHttpServer())
      .post(`/pay-periods/${createdPayPeriodId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(finalized.body.status).toBe('FINALIZED');
  });
});
