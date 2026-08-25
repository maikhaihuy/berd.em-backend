/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@modules/prisma/prisma.service';
import { SubShiftType, TimeLogStatus } from '@prisma/client';

/**
 * End-to-end coverage for row-scoped ("-own") permission conditions on
 * time-logs, exercised through the full app (JWT + PermissionsGuard active)
 * with the real seeded dev Employee. Confirms the guard's `-own` resolution
 * and the service's condition-filtering hold across the actual request
 * pipeline, not just in isolated unit tests.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('Time-logs row-scoping (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeToken: string;
  let employeeId: number;

  let branchId: number;
  let otherEmployeeId: number;
  let ownAssignmentId: number;
  let otherAssignmentId: number;
  let otherTimeLogId: number;

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

    // Minimal fixture chain, created directly via Prisma (no templates
    // needed — masterShiftTemplateId/subShiftTemplateId are optional):
    // Branch -> MasterShift -> SubShift -> Assignment(s) -> TimeLog.
    const branch = await prisma.branch.create({
      data: {
        name: `E2E Row-Scoping Branch ${Date.now()}`,
        abbreviation: `E2ERS${Date.now().toString().slice(-6)}`,
        address: 'n/a',
        createdBy: 1,
        updatedBy: 1,
      },
    });
    branchId = branch.id;

    const masterShift = await prisma.masterShift.create({
      data: {
        branchId,
        workDate: new Date('2026-09-01'),
        title: 'E2E Master Shift',
        startTime: new Date('2026-09-01T08:00:00Z'),
        endTime: new Date('2026-09-01T17:00:00Z'),
        createdBy: 1,
        updatedBy: 1,
      },
    });

    const subShift = await prisma.subShift.create({
      data: {
        masterShiftId: masterShift.id,
        title: 'E2E Sub Shift',
        type: SubShiftType.MAIN,
        startTime: new Date('2026-09-01T08:00:00Z'),
        endTime: new Date('2026-09-01T17:00:00Z'),
        createdBy: 1,
        updatedBy: 1,
      },
    });

    const otherEmployee = await prisma.employee.create({
      data: {
        fullName: 'E2E Other Employee',
        phoneNumber: `0900${Date.now().toString().slice(-6)}`,
        createdBy: 1,
        updatedBy: 1,
      },
    });
    otherEmployeeId = otherEmployee.id;

    const ownAssignment = await prisma.assignment.create({
      data: {
        employeeId,
        subShiftId: subShift.id,
        createdBy: 1,
        updatedBy: 1,
      },
    });
    ownAssignmentId = ownAssignment.id;

    const otherAssignment = await prisma.assignment.create({
      data: {
        employeeId: otherEmployeeId,
        subShiftId: subShift.id,
        createdBy: 1,
        updatedBy: 1,
      },
    });
    otherAssignmentId = otherAssignment.id;

    const otherTimeLog = await prisma.timeLog.create({
      data: {
        assignmentId: otherAssignmentId,
        employeeId: otherEmployeeId,
        multiplier: 1,
        status: TimeLogStatus.PENDING,
        createdBy: 1,
        updatedBy: 1,
      },
    });
    otherTimeLogId = otherTimeLog.id;
  }, 30000);

  afterAll(async () => {
    // Branch deletion cascades: masterShift -> subShift -> assignments ->
    // timeLogs. Only the extra employee fixture needs its own cleanup.
    // Guarded individually so a partial beforeAll failure doesn't prevent
    // whatever *did* get created from being cleaned up.
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => {});
    }
    if (otherEmployeeId) {
      await prisma.employee
        .delete({ where: { id: otherEmployeeId } })
        .catch(() => {});
    }
    await app?.close();
  });

  it('logs in Admin and the dev Employee', () => {
    expect(adminToken).toBeDefined();
    expect(employeeToken).toBeDefined();
  });

  it("create ignores a spoofed employeeId and uses the caller's own", async () => {
    const res = await request(app.getHttpServer())
      .post('/time-tracking')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        assignmentId: ownAssignmentId,
        employeeId: otherEmployeeId, // spoofed — must be ignored
        multiplier: 1,
      })
      .expect(201);

    expect(res.body.employeeId).toBe(employeeId);
    expect(res.body.employeeId).not.toBe(otherEmployeeId);
  });

  it("list only returns the caller's own time logs", async () => {
    const res = await request(app.getHttpServer())
      .get('/time-tracking')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const timeLog of res.body) {
      expect(timeLog.employeeId).toBe(employeeId);
    }
    expect(res.body.some((t: { id: number }) => t.id === otherTimeLogId)).toBe(
      false,
    );
  });

  it("detail read on another employee's time log 404s, not 403s", async () => {
    await request(app.getHttpServer())
      .get(`/time-tracking/${otherTimeLogId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(404);
  });

  it('an unscoped caller (Admin) is unaffected and can read every time log', async () => {
    const res = await request(app.getHttpServer())
      .get(`/time-tracking/${otherTimeLogId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.id).toBe(otherTimeLogId);
    expect(res.body.employeeId).toBe(otherEmployeeId);
  });
});
