/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the field-level validation error response shape
 * (message + errors map). Requires a seeded DB with the Admin `settings` user.
 */
describe('Validation error response (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdBranchId: number | undefined;

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
  });

  afterAll(async () => {
    if (createdBranchId) {
      await request(app.getHttpServer())
        .delete(`/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('returns a general message plus a field-keyed errors map when multiple fields fail validation', async () => {
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', abbreviation: '', email: 'not-an-email' })
      .expect(400);

    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);

    expect(Array.isArray(res.body.errors.name)).toBe(true);
    expect(res.body.errors.name.length).toBeGreaterThan(0);

    expect(Array.isArray(res.body.errors.abbreviation)).toBe(true);
    expect(res.body.errors.abbreviation.length).toBeGreaterThan(0);

    expect(Array.isArray(res.body.errors.email)).toBe(true);
    expect(res.body.errors.email.length).toBeGreaterThan(0);

    // address is required but was omitted entirely - also reported.
    expect(Array.isArray(res.body.errors.address)).toBe(true);
  });

  it('does not affect a successful request', async () => {
    const suffix = Date.now().toString().slice(-6);
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Validation Branch ${suffix}`,
        abbreviation: `EVB${suffix}`.slice(0, 10),
        address: '1 Test Ave',
      })
      .expect(201);

    createdBranchId = res.body.id as number;

    expect(res.body).not.toHaveProperty('errors');
    expect(res.body.name).toBe(`E2E Validation Branch ${suffix}`);
  });
});
