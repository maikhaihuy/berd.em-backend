/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { FieldValidationException } from '@common/exceptions/field-validation.exception';
import { Prisma, UserStatus } from '@prisma/client';
import { EmployeesService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '@common/services/password.service';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { LoggerService } from '@common/logger/logger.service';

const caslAbilityFactory = new CaslAbilityFactory({
  warn: jest.fn(),
} as unknown as LoggerService);
const unscopedAbility = caslAbilityFactory.createForUser({
  permissions: [{ action: 'read', subject: 'employees' }],
});
const managedBranchAbility = caslAbilityFactory.createForUser({
  permissions: [
    {
      action: 'read',
      subject: 'employees',
      condition: {
        employeeBranches: { some: { branchId: { in: '$managedBranches' } } },
      },
    },
  ],
  managedBranches: [1],
});

describe('EmployeesService', () => {
  let service: EmployeesService;
  let tx: {
    role: { findFirstOrThrow: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock };
    employee: { create: jest.Mock };
    employeeHourlyRate: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let prismaService: {
    branch: { findMany: jest.Mock };
    employee: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    employeeHourlyRate: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwordService: { generateOneTimeCredential: jest.Mock };
  let auditLogsService: { record: jest.Mock };
  let configService: { get: jest.Mock };

  const createDto: CreateEmployeeDto = {
    fullName: 'Jane Doe',
    phoneNumber: '0900000123',
    branchIds: [1],
    primaryBranchId: 1,
  } as CreateEmployeeDto;

  const employeeRow = {
    id: 1,
    fullName: 'Jane Doe',
    phoneNumber: '0900000123',
    avatar: null,
    dateOfBirth: null,
    email: null,
    address: null,
    probationStartDate: null,
    officialStartDate: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
    employeeBranches: [],
    user: null,
  };

  beforeEach(async () => {
    tx = {
      role: { findFirstOrThrow: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
      employee: { create: jest.fn() },
      employeeHourlyRate: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
    };
    prismaService = {
      branch: { findMany: jest.fn() },
      employee: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      employeeHourlyRate: { findMany: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    };
    passwordService = { generateOneTimeCredential: jest.fn() };
    auditLogsService = { record: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prismaService },
        { provide: PasswordService, useValue: passwordService },
        { provide: AuditLogsService, useValue: auditLogsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    beforeEach(() => {
      prismaService.branch.findMany.mockResolvedValue([{ id: 1 }]);
      prismaService.employee.findUnique.mockResolvedValue(null);
    });

    it('auto-provisions a User with a random one-time password and the Employee role when the phone number is free', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tx.role.findFirstOrThrow.mockResolvedValue({ id: 7, name: 'Employee' });
      passwordService.generateOneTimeCredential.mockResolvedValue({
        password: 'RANDOM42',
        hash: 'hashed-random-password',
      });
      tx.user.create.mockResolvedValue({
        id: 99,
        phoneNumber: createDto.phoneNumber,
        fullName: createDto.fullName,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      });
      tx.employee.create.mockResolvedValue({
        id: 1,
        fullName: createDto.fullName,
        phoneNumber: createDto.phoneNumber,
        userId: 99,
        employeeBranches: [],
      });

      const result = await service.create(createDto, 1);

      expect(tx.role.findFirstOrThrow).toHaveBeenCalledWith({
        where: { name: 'Employee' },
      });
      expect(passwordService.generateOneTimeCredential).toHaveBeenCalled();
      expect(tx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNumber: createDto.phoneNumber,
          fullName: createDto.fullName,
          password: 'hashed-random-password',
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
          mustChangePasswordExpiresAt: expect.any(Date),
          userRoles: { create: [{ roleId: 7 }] },
        }),
      });
      expect(tx.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 99 }),
        }),
      );
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 1,
          action: 'create',
          subject: 'users',
          entityId: 99,
        }),
        tx,
      );
      // The plaintext one-time credential is returned exactly once, in the create response.
      expect(result.temporaryPassword).toBe('RANDOM42');
    });

    it('rejects with FieldValidationException and creates no Employee when a User with that phone number already exists', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 5 });

      await expect(service.create(createDto, 1)).rejects.toBeInstanceOf(
        FieldValidationException,
      );

      expect(tx.user.create).not.toHaveBeenCalled();
      expect(tx.employee.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes the list by the caller managed-branch ability', async () => {
      prismaService.employee.findMany.mockResolvedValue([]);

      await service.findAll(managedBranchAbility);

      expect(prismaService.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [accessibleWhere(managedBranchAbility, 'read', 'employees')],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the employee does not exist', async () => {
      prismaService.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(999, unscopedAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the lookup by the caller managed-branch ability', async () => {
      prismaService.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(1, managedBranchAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaService.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            AND: [accessibleWhere(managedBranchAbility, 'read', 'employees')],
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.update(99, { fullName: 'New Name' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects reassigning to a phone number already used by another employee', async () => {
      prismaService.employee.findUnique
        .mockResolvedValueOnce(employeeRow)
        .mockResolvedValueOnce({ ...employeeRow, id: 2 });

      await expect(
        service.update(1, { phoneNumber: '0900000999' }, 1),
      ).rejects.toBeInstanceOf(FieldValidationException);
      expect(prismaService.employee.update).not.toHaveBeenCalled();
    });

    it('updates an employee and resyncs its branch assignments', async () => {
      prismaService.employee.findUnique
        .mockResolvedValueOnce(employeeRow)
        .mockResolvedValueOnce(null);
      prismaService.employee.update.mockResolvedValue({
        ...employeeRow,
        fullName: 'Jane Updated',
        employeeBranches: [],
      });

      const result = await service.update(
        1,
        { fullName: 'Jane Updated', branchIds: [2] },
        1,
      );

      expect(result.fullName).toBe('Jane Updated');
      expect(prismaService.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            employeeBranches: expect.objectContaining({
              deleteMany: {},
              create: [{ branchId: 2, isPrimary: false }],
            }),
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFound when the employee does not exist (P2025)', async () => {
      prismaService.employee.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('missing', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes an employee', async () => {
      prismaService.employee.delete.mockResolvedValue(employeeRow);
      await service.remove(1);
      expect(prismaService.employee.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('syncHourlyRates', () => {
    const existingRates = [{ id: 1 }, { id: 2 }];

    beforeEach(() => {
      prismaService.employee.findUnique.mockResolvedValue(employeeRow);
    });

    it('throws NotFound when the employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);
      await expect(service.syncHourlyRates(999, [], 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates only, when every entry in the dto is new', async () => {
      prismaService.employeeHourlyRate.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.syncHourlyRates(
        1,
        [{ rate: 25, effectiveDate: new Date('2026-01-01') }],
        1,
      );

      expect(tx.employeeHourlyRate.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({ employeeId: 1, rate: expect.anything() }),
          ],
        }),
      );
      expect(tx.employeeHourlyRate.update).not.toHaveBeenCalled();
      expect(tx.employeeHourlyRate.deleteMany).not.toHaveBeenCalled();
    });

    it('updates only, when every entry in the dto matches an existing rate', async () => {
      prismaService.employeeHourlyRate.findMany
        .mockResolvedValueOnce(existingRates)
        .mockResolvedValueOnce([]);

      await service.syncHourlyRates(
        1,
        [
          { id: 1, rate: 30, effectiveDate: new Date('2026-01-01') },
          { id: 2, rate: 35, effectiveDate: new Date('2026-01-01') },
        ],
        1,
      );

      expect(tx.employeeHourlyRate.update).toHaveBeenCalledTimes(2);
      expect(tx.employeeHourlyRate.createMany).not.toHaveBeenCalled();
      expect(tx.employeeHourlyRate.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes only, when the dto omits every existing rate', async () => {
      prismaService.employeeHourlyRate.findMany
        .mockResolvedValueOnce(existingRates)
        .mockResolvedValueOnce([]);

      await service.syncHourlyRates(1, [], 1);

      expect(tx.employeeHourlyRate.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });
      expect(tx.employeeHourlyRate.createMany).not.toHaveBeenCalled();
      expect(tx.employeeHourlyRate.update).not.toHaveBeenCalled();
    });

    it('creates, updates, and deletes in one call when the dto is a mixed diff', async () => {
      prismaService.employeeHourlyRate.findMany
        .mockResolvedValueOnce(existingRates)
        .mockResolvedValueOnce([]);

      await service.syncHourlyRates(
        1,
        [
          { id: 1, rate: 40, effectiveDate: new Date('2026-01-01') },
          { rate: 20, effectiveDate: new Date('2026-02-01') },
        ],
        1,
      );

      // id 1 updated, id 2 (omitted) deleted, the id-less entry created.
      expect(tx.employeeHourlyRate.update).toHaveBeenCalledTimes(1);
      expect(tx.employeeHourlyRate.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [2] } },
      });
      expect(tx.employeeHourlyRate.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ rate: expect.anything() })],
        }),
      );
    });
  });
});
