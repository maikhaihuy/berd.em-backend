/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { FieldValidationException } from '@common/exceptions/field-validation.exception';
import { UserStatus } from '@prisma/client';
import { EmployeesService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '@common/services/password.service';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let tx: {
    role: { findFirstOrThrow: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock };
    employee: { create: jest.Mock };
  };
  let prismaService: {
    branch: { findMany: jest.Mock };
    employee: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwordService: { hash: jest.Mock };
  let auditLogsService: { record: jest.Mock };

  const createDto: CreateEmployeeDto = {
    fullName: 'Jane Doe',
    phoneNumber: '0900000123',
    branchIds: [1],
    primaryBranchId: 1,
  } as CreateEmployeeDto;

  beforeEach(async () => {
    tx = {
      role: { findFirstOrThrow: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
      employee: { create: jest.fn() },
    };
    prismaService = {
      branch: { findMany: jest.fn() },
      employee: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    };
    passwordService = { hash: jest.fn() };
    auditLogsService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prismaService },
        { provide: PasswordService, useValue: passwordService },
        { provide: AuditLogsService, useValue: auditLogsService },
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

    it('auto-provisions a User with a phone-derived password and the Employee role when the phone number is free', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tx.role.findFirstOrThrow.mockResolvedValue({ id: 7, name: 'Employee' });
      passwordService.hash.mockResolvedValue('hashed-phone-password');
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

      await service.create(createDto, 1);

      expect(tx.role.findFirstOrThrow).toHaveBeenCalledWith({
        where: { name: 'Employee' },
      });
      expect(passwordService.hash).toHaveBeenCalledWith(createDto.phoneNumber);
      expect(tx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNumber: createDto.phoneNumber,
          fullName: createDto.fullName,
          password: 'hashed-phone-password',
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
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
});
