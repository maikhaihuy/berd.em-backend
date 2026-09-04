/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end coverage for the `branches` CRUD surface as its own subject —
 * previously only exercised incidentally as fixture setup inside other e2e
 * specs. Requires a seeded DB with the Admin `settings` user.
 */
describe('Branches (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let branchId: number;

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
  }, 30000);

  afterAll(async () => {
    if (branchId) {
      await request(app.getHttpServer())
        .delete(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    await app.close();
  });

  it('creates a branch', async () => {
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Branch ${suffix}`,
        abbreviation: `EB${suffix}`.slice(0, 10),
        address: '1 Test Ave',
      })
      .expect(201);
    expect(res.body.name).toBe(`E2E Branch ${suffix}`);
    branchId = res.body.id as number;
  });

  // NOTE: `BranchesService.create` catches P2002 and maps it to a "duplicate
  // name/abbreviation" 400, but `Branch` in prisma/schema.prisma has no
  // `@unique`/`@@unique` on `name` or `abbreviation` — that catch branch is
  // currently unreachable in practice. A second branch with the same name
  // and abbreviation succeeds today; this test documents actual behavior
  // rather than the aspirational one, per this change's no-behavior-change
  // scope (see design.md Non-Goals). Fixing the schema is a separate change.
  it('allows a second branch with the same name/abbreviation (no unique constraint today)', async () => {
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Branch ${suffix}`,
        abbreviation: `EB${suffix}`.slice(0, 10),
        address: '2 Other Ave',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/branches/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .catch(() => {});
  });

  it('lists branches, including the one just created', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ids = (res.body as { id: number }[]).map((b) => b.id);
    expect(ids).toContain(branchId);
  });

  it('fetches a branch by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(branchId);
  });

  it('returns 404 fetching a non-existent branch', async () => {
    await request(app.getHttpServer())
      .get('/branches/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('updates a branch', async () => {
    const res = await request(app.getHttpServer())
      .put(`/branches/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ address: '99 Updated Ave' })
      .expect(200);
    expect(res.body.address).toBe('99 Updated Ave');
  });

  it('returns 404 updating a non-existent branch', async () => {
    await request(app.getHttpServer())
      .put('/branches/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ address: 'nowhere' })
      .expect(404);
  });

  it('deletes a branch', async () => {
    await request(app.getHttpServer())
      .delete(`/branches/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/branches/${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    branchId = 0;
  });

  it('returns 404 deleting a non-existent branch', async () => {
    await request(app.getHttpServer())
      .delete('/branches/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
