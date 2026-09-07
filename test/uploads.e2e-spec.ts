/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { R2StorageService } from '../src/modules/uploads/r2-storage.service';

/**
 * End-to-end coverage for POST /uploads. The R2StorageService provider is
 * overridden with an in-memory stub so the suite never talks to real
 * Cloudflare infrastructure — only HTTP/auth/validation behavior is
 * exercised here (storage behavior itself is unit-tested in
 * uploads.service.spec.ts). Requires a seeded DB with the Admin `settings`
 * user and the dev Employee.
 */
describe('Uploads (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let noPermissionToken: string;

  let roleId: number;
  let testUserId: number;

  const suffix = Date.now().toString().slice(-6);
  const putObjectMock = jest
    .fn()
    .mockResolvedValue('https://pub-dev.r2.dev/uploads/e2e-test-key.jpg');

  const tinyJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0xff, 0xd9,
  ]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(R2StorageService)
      .useValue({ putObject: putObjectMock })
      .compile();

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

    // A throwaway role with a permission unrelated to uploads, to exercise
    // the "authenticated but lacking the create:uploads grant" 403 case —
    // every seeded system role (Admin/Manager/Employee) is granted
    // create:uploads, so none of them can stand in for this case.
    const permissionsRes = await request(app.getHttpServer())
      .get('/permissions')
      .set('Authorization', `Bearer ${adminToken}`);
    const permissions = permissionsRes.body as {
      id: number;
      action: string;
      subject: string;
    }[];
    const readBranchesPermissionId = permissions.find(
      (p) => p.action === 'read' && p.subject === 'branches',
    )!.id;

    const roleRes = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E No Upload Role ${suffix}`,
        permissionIds: [readBranchesPermissionId],
      });
    roleId = roleRes.body.id as number;

    const userRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phoneNumber: `09098${suffix}`,
        fullName: 'E2E No Upload User',
        status: 'ACTIVE',
        password: 'NoUpload!123',
        roleIds: [roleId],
      });
    testUserId = userRes.body.id as number;

    const noPermissionLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `09098${suffix}`, password: 'NoUpload!123' });
    noPermissionToken = noPermissionLogin.body.accessToken as string;
  }, 30000);

  afterAll(async () => {
    if (testUserId) {
      await request(app.getHttpServer())
        .delete(`/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    if (roleId) {
      await request(app.getHttpServer())
        .delete(`/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    await app.close();
  });

  beforeEach(() => {
    putObjectMock.mockClear();
  });

  it('rejects an unauthenticated request (401)', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('files', tinyJpegBuffer, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .expect(401);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('rejects an authenticated caller lacking the create:uploads permission (403)', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${noPermissionToken}`)
      .attach('files', tinyJpegBuffer, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('uploads a valid image and returns a durable URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('files', tinyJpegBuffer, {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      url: 'https://pub-dev.r2.dev/uploads/e2e-test-key.jpg',
      mimeType: 'image/jpeg',
    });
    expect(putObjectMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a disallowed file type without storing anything', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('files', Buffer.from('not an image'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});
