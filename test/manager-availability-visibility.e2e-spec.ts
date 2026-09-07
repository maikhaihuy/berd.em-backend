/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@modules/prisma/prisma.service';
import { SubShiftType } from '@prisma/client';

/**
 * End-to-end coverage for the expose-manager-availability-view change: a
 * Manager can now read (never write) every employee's registered
 * availability for branches they manage, scoped by the new
 * SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION seed grant; an Employee's own
 * visibility stays self-scoped regardless of query params; and
 * DELETE /availability/:id enforces ownership via an instance-level CASL
 * check (404, not 403).
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('Manager availability visibility (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let employeeToken: string;
  let employeeId: number;

  let managerToken: string;
  let managerUserId: number;

  let secondEmployeeToken: string;
  let secondEmployeeId: number;

  let branchAId: number;
  let branchBId: number;
  let subShiftAId: number;
  let subShiftBId: number;
  let subShiftDeleteTestId: number;

  let availDevAId: number;
  let availOtherAId: number;
  let availOtherBId: number;

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

    const employee = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '0900000001', password: 'DevLogin!123' });
    employeeToken = employee.body.accessToken as string;

    const devEmployee = await prisma.employee.findUniqueOrThrow({
      where: { phoneNumber: '0900000001' },
    });
    employeeId = devEmployee.id;

    // Fixtures: two branches, one MasterShift+SubShift each.
    const branchA = await prisma.branch.create({
      data: {
        name: `E2E Availability Branch A ${Date.now()}`,
        abbreviation: `AVA${Date.now().toString().slice(-6)}`,
        address: 'n/a',
        createdBy: 1,
        updatedBy: 1,
      },
    });
    branchAId = branchA.id;

    const branchB = await prisma.branch.create({
      data: {
        name: `E2E Availability Branch B ${Date.now()}`,
        abbreviation: `AVB${Date.now().toString().slice(-6)}`,
        address: 'n/a',
        createdBy: 1,
        updatedBy: 1,
      },
    });
    branchBId = branchB.id;

    const buildSubShift = async (branchId: number, label: string) => {
      const masterShift = await prisma.masterShift.create({
        data: {
          branchId,
          workDate: new Date('2026-09-14'),
          title: `E2E ${label} Master Shift`,
          startTime: new Date('2026-09-14T08:00:00Z'),
          endTime: new Date('2026-09-14T17:00:00Z'),
          createdBy: 1,
          updatedBy: 1,
        },
      });
      const subShift = await prisma.subShift.create({
        data: {
          masterShiftId: masterShift.id,
          title: `E2E ${label} Sub Shift`,
          type: SubShiftType.MAIN,
          startTime: new Date('2026-09-14T08:00:00Z'),
          endTime: new Date('2026-09-14T17:00:00Z'),
          createdBy: 1,
          updatedBy: 1,
        },
      });
      return subShift.id;
    };
    subShiftAId = await buildSubShift(branchAId, 'A');
    subShiftBId = await buildSubShift(branchBId, 'B');
    // A dedicated sub-shift so the DELETE-ownership tests below (which each
    // create-then-delete a row for the second employee) never collide with
    // the unique (employeeId, subShiftId) row seeded on subShiftBId.
    subShiftDeleteTestId = await buildSubShift(branchBId, 'Delete-Test');

    // A second employee, fully onboarded (password changed) so its token is
    // usable for ordinary routes (not blocked by ForcePasswordChangeGuard).
    const secondEmployeePhone = `0903${Date.now().toString().slice(-6)}`;
    const secondEmployeeRes = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'E2E Availability Second Employee',
        phoneNumber: secondEmployeePhone,
        branchIds: [branchAId],
        primaryBranchId: branchAId,
      })
      .expect(201);
    secondEmployeeId = secondEmployeeRes.body.id as number;
    const secondEmployeeTempPassword = secondEmployeeRes.body
      .temporaryPassword as string;

    const bootstrapLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: secondEmployeePhone,
        password: secondEmployeeTempPassword,
      })
      .expect(200);
    const bootstrapToken = bootstrapLogin.body.accessToken as string;

    const secondEmployeePassword = 'E2EAvailabilitySecond!123';
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${bootstrapToken}`)
      .send({
        currentPassword: secondEmployeeTempPassword,
        newPassword: secondEmployeePassword,
      })
      .expect(200);

    const secondEmployeeLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: secondEmployeePhone, password: secondEmployeePassword })
      .expect(200);
    secondEmployeeToken = secondEmployeeLogin.body.accessToken as string;

    // Manager, managing only Branch A.
    const rolesRes = await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const managerRoleId = (
      rolesRes.body as { id: number; name: string }[]
    ).find((r) => r.name === 'Manager')!.id;

    const managerPassword = 'E2EAvailabilityManager!123';
    const managerPhone = `0904${Date.now().toString().slice(-6)}`;
    const managerRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phoneNumber: managerPhone,
        fullName: 'E2E Availability Manager',
        status: 'ACTIVE',
        roleIds: [managerRoleId],
        password: managerPassword,
      })
      .expect(201);
    managerUserId = managerRes.body.id as number;

    const managerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: managerPhone, password: managerPassword })
      .expect(200);
    managerToken = managerLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .post(`/users/${managerUserId}/manager-branches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ branchIds: [branchAId] })
      .expect(201);

    // Availability rows: dev employee + second employee both under Branch
    // A's sub-shift; second employee also under Branch B's sub-shift.
    const availDevA = await request(app.getHttpServer())
      .post('/availability')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ employeeId, subShiftId: subShiftAId })
      .expect(201);
    availDevAId = availDevA.body.id as number;

    const availOtherA = await request(app.getHttpServer())
      .post('/availability')
      .set('Authorization', `Bearer ${secondEmployeeToken}`)
      .send({ employeeId: secondEmployeeId, subShiftId: subShiftAId })
      .expect(201);
    availOtherAId = availOtherA.body.id as number;

    const availOtherB = await request(app.getHttpServer())
      .post('/availability')
      .set('Authorization', `Bearer ${secondEmployeeToken}`)
      .send({ employeeId: secondEmployeeId, subShiftId: subShiftBId })
      .expect(201);
    availOtherBId = availOtherB.body.id as number;
  }, 60000);

  afterAll(async () => {
    // Branch deletion cascades: masterShift -> subShift -> availability.
    // Users/employees need their own cleanup.
    if (managerUserId) {
      await request(app.getHttpServer())
        .delete(`/users/${managerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    if (secondEmployeeId) {
      await request(app.getHttpServer())
        .delete(`/employees/${secondEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    if (branchAId) {
      await prisma.branch.delete({ where: { id: branchAId } }).catch(() => {});
    }
    if (branchBId) {
      await prisma.branch.delete({ where: { id: branchBId } }).catch(() => {});
    }
    await app?.close();
  });

  it('has all tokens and fixtures ready', () => {
    expect(adminToken).toBeDefined();
    expect(employeeToken).toBeDefined();
    expect(managerToken).toBeDefined();
    expect(secondEmployeeToken).toBeDefined();
  });

  describe('Manager read scoping', () => {
    it('lists every employee’s availability for a branch it manages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/availability?date=2026-09-14&branchId=${branchAId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const ids = (res.body as { id: number }[]).map((a) => a.id);
      expect(ids).toContain(availDevAId);
      expect(ids).toContain(availOtherAId);
      expect(ids).not.toContain(availOtherBId);
    });

    it('returns an empty list (not 403) for a branch it does not manage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/availability?date=2026-09-14&branchId=${branchBId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('narrows to one sub-shift via subShiftId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/availability?date=2026-09-14&subShiftId=${subShiftAId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const ids = (res.body as { id: number }[]).map((a) => a.id);
      expect(ids.sort()).toEqual([availDevAId, availOtherAId].sort());
    });

    it('fetches a single row in a managed branch by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/availability/${availOtherAId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body.id).toBe(availOtherAId);
    });

    it('404s fetching a single row outside its managed branches', async () => {
      await request(app.getHttpServer())
        .get(`/availability/${availOtherBId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);
    });
  });

  describe('Employee read scoping stays self-only regardless of query params', () => {
    it('omitting branchId returns only the caller’s own rows', async () => {
      const res = await request(app.getHttpServer())
        .get('/availability?date=2026-09-14')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const ids = (res.body as { id: number }[]).map((a) => a.id);
      expect(ids).toContain(availDevAId);
      expect(ids).not.toContain(availOtherAId);
    });

    it('supplying branchId/subShiftId for another employee’s row still returns only own rows', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/availability?date=2026-09-14&branchId=${branchAId}&subShiftId=${subShiftAId}`,
        )
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const ids = (res.body as { id: number }[]).map((a) => a.id);
      expect(ids).toEqual([availDevAId]);
    });

    it('404s fetching another employee’s row by id', async () => {
      await request(app.getHttpServer())
        .get(`/availability/${availOtherAId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(404);
    });
  });

  describe('Manager holds no write access to availability', () => {
    it('403s on POST /availability', async () => {
      await request(app.getHttpServer())
        .post('/availability')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ employeeId: secondEmployeeId, subShiftId: subShiftAId })
        .expect(403);
    });

    it('403s on PATCH /availability/:id', async () => {
      await request(app.getHttpServer())
        .patch(`/availability/${availOtherAId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ note: 'manager edit attempt' })
        .expect(403);
    });

    it('403s on DELETE /availability/:id', async () => {
      await request(app.getHttpServer())
        .delete(`/availability/${availOtherAId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });
  });

  describe('DELETE /availability/:id ownership', () => {
    const createRow = async (token: string, employeeIdForRow: number) => {
      const res = await request(app.getHttpServer())
        .post('/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          employeeId: employeeIdForRow,
          subShiftId: subShiftDeleteTestId,
        })
        .expect(201);
      return res.body.id as number;
    };

    it('404s when a non-owning employee attempts the delete', async () => {
      const rowId = await createRow(secondEmployeeToken, secondEmployeeId);

      await request(app.getHttpServer())
        .delete(`/availability/${rowId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(404);

      // Row still exists — clean it up as the owner.
      await request(app.getHttpServer())
        .delete(`/availability/${rowId}`)
        .set('Authorization', `Bearer ${secondEmployeeToken}`)
        .expect(200);
    });

    it('succeeds when the owning employee deletes their own row', async () => {
      const rowId = await createRow(secondEmployeeToken, secondEmployeeId);

      await request(app.getHttpServer())
        .delete(`/availability/${rowId}`)
        .set('Authorization', `Bearer ${secondEmployeeToken}`)
        .expect(200);
    });

    it('succeeds when Admin deletes any row', async () => {
      const rowId = await createRow(secondEmployeeToken, secondEmployeeId);

      await request(app.getHttpServer())
        .delete(`/availability/${rowId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
