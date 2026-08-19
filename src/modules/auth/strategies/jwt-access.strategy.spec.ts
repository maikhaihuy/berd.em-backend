import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';
import { AccessTokenPayloadDto } from '../dto/access-token-payload.dto';
import { UserStatus } from '@prisma/client';

describe('JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;
  let prismaService: { user: { findUnique: jest.Mock } };
  let configService: jest.Mocked<ConfigService>;

  const buildPermission = (action: string, subject: string) => ({
    id: 1,
    action,
    subject,
    condition: null,
    description: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  });

  const mockUser = {
    id: 1,
    zaloId: 'zalo_test',
    phoneNumber: '0900000000',
    password: 'hashedPassword',
    fullName: 'Test User',
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    roleId: 1,
    role: {
      id: 1,
      name: 'Employee',
      description: null,
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 1,
      rolePermissions: [
        {
          roleId: 1,
          permissionId: 1,
          permission: buildPermission('read', 'users'),
        },
        {
          roleId: 1,
          permissionId: 2,
          permission: buildPermission('read', 'employees'),
        },
      ],
    },
    employee: {
      id: 42,
      employeeBranches: [
        { employeeId: 42, branchId: 7, isPrimary: true },
        { employeeId: 42, branchId: 9, isPrimary: false },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayload: AccessTokenPayloadDto = {
    sub: 1,
    phone: '0900000000',
    role: 'Employee',
    branches: [],
    iat: Math.floor(new Date('2026-01-01').getTime() / 1000),
    exp: Math.floor(new Date('2026-01-01').getTime() / 1000) + 3600,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAccessStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtAccessStrategy>(JwtAccessStrategy);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
    expect(configService).toBeDefined();
  });

  describe('validate', () => {
    it('returns an authenticated user with role name and flattened permissions', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockPayload);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockPayload.sub } }),
      );
      expect(result).toBeInstanceOf(AuthenticatedUserDto);
      expect(result.userId).toBe(mockUser.id);
      expect(result.phone).toBe(mockUser.phoneNumber);
      expect(result.employeeId).toBe(mockUser.employee.id);
      expect(result.branches).toEqual([7, 9]);
      expect(result.role).toBe('Employee');
      expect(result.permissions).toEqual([
        { action: 'read', subject: 'users' },
        { action: 'read', subject: 'employees' },
      ]);
    });

    it('leaves employeeId undefined and branches empty when the user has no linked employee', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        employee: null,
      });

      const result = await strategy.validate(mockPayload);

      expect(result.userId).toBe(mockUser.id);
      expect(result.employeeId).toBeUndefined();
      expect(result.branches).toEqual([]);
    });

    it('returns an empty permissions array when the role has none', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: { ...mockUser.role, rolePermissions: [] },
      });

      const result = await strategy.validate(mockPayload);

      expect(result.permissions).toEqual([]);
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('propagates database errors', async () => {
      const dbError = new Error('Database connection error');
      prismaService.user.findUnique.mockRejectedValue(dbError);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(dbError);
    });
  });
});
