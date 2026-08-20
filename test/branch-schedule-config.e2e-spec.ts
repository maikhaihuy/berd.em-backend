/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the branch-schedule-configs CRUD surface. Requires a
 * seeded DB with the Admin `settings` user and the dev Employee.
 */
describe('BranchScheduleConfig (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let branchId: number;
  let configId: number;

  const suffix = Date.now().toString().slice(-6);

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

    // A throwaway branch to attach the config to.
    const branch = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Sched Branch ${suffix}`,
        abbreviation: `E2E${suffix}`.slice(0, 10),
        address: '1 Test Ave',
      });
    branchId = branch.body.id as number;
  });

  afterAll(async () => {
    if (branchId) {
      await request(app.getHttpServer())
        .delete(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('denies a non-admin without the permission (403)', async () => {
    // Employee has read but not create on branch-schedule-configs.
    await request(app.getHttpServer())
      .post('/branch-schedule-configs')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ branchId })
      .expect(403);
  });

  it('creates a config', async () => {
    const res = await request(app.getHttpServer())
      .post('/branch-schedule-configs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        branchId,
        allowCustomAvailabilityTime: true,
        availabilityOpenDaysBefore: 7,
      })
      .expect(201);
    expect(res.body.branchId).toBe(branchId);
    configId = res.body.id as number;
  });

  it('rejects a second config for the same branch (400)', async () => {
    await request(app.getHttpServer())
      .post('/branch-schedule-configs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ branchId })
      .expect(400);
  });

  it('fetches the config by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/branch-schedule-configs/${configId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(configId);
  });

  it('fetches the config by branch id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/branch-schedule-configs/branch/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.branchId).toBe(branchId);
  });

  it('updates the config', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branch-schedule-configs/${configId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ scheduleGenerationDay: 20 })
      .expect(200);
    expect(res.body.scheduleGenerationDay).toBe(20);
  });

  it('deletes the config', async () => {
    await request(app.getHttpServer())
      .delete(`/branch-schedule-configs/${configId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/branch-schedule-configs/${configId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
