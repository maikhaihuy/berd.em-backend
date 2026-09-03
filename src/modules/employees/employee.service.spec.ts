/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
  let passwordService: { generateOneTimeCredential: jest.Mock };
  let auditLogsService: { record: jest.Mock };
  let configService: { get: jest.Mock };

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
});
