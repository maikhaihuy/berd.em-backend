/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@modules/prisma/prisma.service';
import { SubShiftType, TimeLogStatus } from '@prisma/client';

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

/**
 * End-to-end coverage for expose-employee-facing-earnings-summary: the
 * bonus field/endpoint and the employee earnings summary endpoint, exercised
 * through the full app (JWT + PermissionsGuard active) with a real generated
 * PayrollEntry for the seeded dev Employee.
 */
describe('Payroll earnings summary & bonus (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeToken: string;
  let managerToken: string;
  let employeeId: number;
  let managerUserId: number;

  let branchId: number;
  let payPeriodId: number;
  let payrollEntryId: number;
  let employeeHourlyRateId: number;

  // 8h shift, 60min of which is overtime, rate 10/hr, multiplier 1
  // -> totalPay = 80.00, approvedOt = 10.00, shiftPay = 70.00.
  const workDate = new Date('2026-08-20T08:00:00Z');
  const workEndDate = new Date('2026-08-20T16:00:00Z');
  const rangeFrom = '2026-08-16T00:00:00.000Z';
  const rangeTo = '2026-08-31T23:59:59.999Z';

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

    const rolesRes = await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const managerRoleId = (
      rolesRes.body as { id: number; name: string }[]
    ).find((r) => r.name === 'Manager')!.id;

    const managerPassword = 'E2EManagerPass!123';
    const managerUserRes = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phoneNumber: `09097${Date.now() % 100000}`,
        fullName: 'E2E Payroll Summary Manager',
        status: 'ACTIVE',
        roleIds: [managerRoleId],
        password: managerPassword,
      })
      .expect(201);
    managerUserId = managerUserRes.body.id as number;

    const managerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: managerUserRes.body.phoneNumber as string,
        password: managerPassword,
      })
      .expect(200);
    managerToken = managerLogin.body.accessToken as string;

    // Minimal fixture chain via Prisma directly (same pattern as
    // time-tracking-row-scoping.e2e-spec.ts): Branch -> MasterShift ->
    // SubShift -> Assignment -> TimeLog (VERIFIED, with overtimeMinutes).
    const branch = await prisma.branch.create({
      data: {
        name: `E2E Earnings Summary Branch ${Date.now()}`,
        abbreviation: `E2EES${Date.now().toString().slice(-6)}`,
        address: 'n/a',
        createdBy: 1,
        updatedBy: 1,
      },
    });
    branchId = branch.id;

    const masterShift = await prisma.masterShift.create({
      data: {
        branchId,
        workDate,
        title: 'E2E Earnings Master Shift',
        startTime: workDate,
        endTime: workEndDate,
        createdBy: 1,
        updatedBy: 1,
      },
    });

    const subShift = await prisma.subShift.create({
      data: {
        masterShiftId: masterShift.id,
        title: 'E2E Earnings Sub Shift',
        type: SubShiftType.MAIN,
        startTime: workDate,
        endTime: workEndDate,
        createdBy: 1,
        updatedBy: 1,
      },
    });

    const assignment = await prisma.assignment.create({
      data: {
        employeeId,
        subShiftId: subShift.id,
        createdBy: 1,
        updatedBy: 1,
      },
    });

    await prisma.timeLog.create({
      data: {
        assignmentId: assignment.id,
        employeeId,
        actualStartTime: workDate,
        actualEndTime: workEndDate,
        overtimeMinutes: 60,
        multiplier: 1,
        status: TimeLogStatus.VERIFIED,
        createdBy: 1,
        updatedBy: 1,
      },
    });

    const hourlyRate = await prisma.employeeHourlyRate.create({
      data: {
        employeeId,
        rate: 10,
        effectiveDate: new Date('2026-01-01T00:00:00Z'),
        createdBy: 1,
        updatedBy: 1,
      },
    });
    employeeHourlyRateId = hourlyRate.id;

    const payPeriodRes = await request(app.getHttpServer())
      .post('/pay-periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: rangeFrom, endDate: rangeTo })
      .expect(201);
    payPeriodId = payPeriodRes.body.id as number;

    const generateRes = await request(app.getHttpServer())
      .post('/payroll-entries/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payPeriodId })
      .expect(201);
    expect(generateRes.body.created).toHaveLength(1);
    payrollEntryId = generateRes.body.created[0].id as number;
  }, 30000);

  afterAll(async () => {
    // Deleting the branch cascades masterShift -> subShift -> assignment ->
    // timeLog -> payrollEntry (each relation is onDelete: Cascade), so the
    // pay period is left with zero entries and can be deleted directly.
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => {});
    }
    if (employeeHourlyRateId) {
      await prisma.employeeHourlyRate
        .delete({ where: { id: employeeHourlyRateId } })
        .catch(() => {});
    }
    if (payPeriodId) {
      await request(app.getHttpServer())
        .delete(`/pay-periods/${payPeriodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    if (managerUserId) {
      await request(app.getHttpServer())
        .delete(`/users/${managerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    await app?.close();
  });

  it('Employee fetches their own summary with the regular/OT split derived from overtimeMinutes', async () => {
    const res = await request(app.getHttpServer())
      .get('/payroll-entries/summary')
      .query({ from: rangeFrom, to: rangeTo })
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(res.body.employeeId).toBe(employeeId);
    expect(res.body.shiftPay).toBe(70);
    expect(res.body.approvedOt).toBe(10);
    expect(res.body.bonus).toBe(0);
    expect(res.body.total).toBe(80);
  });

  it('Employee cannot set a bonus (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/payroll-entries/${payrollEntryId}/bonus`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ bonus: 999 })
      .expect(403);
  });

  it('Manager sets a bonus, and it is reflected in a subsequent summary call', async () => {
    const patchRes = await request(app.getHttpServer())
      .patch(`/payroll-entries/${payrollEntryId}/bonus`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bonus: 25 })
      .expect(200);
    expect(patchRes.body.bonus).toBe(25);
    expect(patchRes.body.totalPay).toBe(80); // untouched

    const summaryRes = await request(app.getHttpServer())
      .get('/payroll-entries/summary')
      .query({ from: rangeFrom, to: rangeTo })
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(summaryRes.body.bonus).toBe(25);
    expect(summaryRes.body.total).toBe(105);
  });

  it('reports the previous finalized period once it is closed and finalized', async () => {
    await request(app.getHttpServer())
      .post(`/pay-periods/${payPeriodId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/pay-periods/${payPeriodId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/payroll-entries/summary')
      .query({ from: rangeFrom, to: rangeTo })
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(res.body.previousPeriod).toMatchObject({
      payPeriodId,
      status: 'FINALIZED',
      totalPaid: 105,
    });
  });
});
