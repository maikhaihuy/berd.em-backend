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
    description: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  });

  const employeeRole = {
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
        condition: null,
        permission: buildPermission('read', 'users'),
      },
      {
        roleId: 1,
        permissionId: 2,
        condition: null,
        permission: buildPermission('read', 'employees'),
      },
    ],
  };

  const mockUser = {
    id: 1,
    zaloId: 'zalo_test',
    phoneNumber: '0900000000',
    password: 'hashedPassword',
    fullName: 'Test User',
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    userRoles: [{ userId: 1, roleId: 1, role: employeeRole }],
    managerBranches: [],
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
    roles: ['Employee'],
    branches: [],
    managedBranches: [],
    mustChangePassword: false,
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
    it('returns an authenticated user with role names and flattened permissions', async () => {
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
      expect(result.managedBranches).toEqual([]);
      expect(result.roles).toEqual(['Employee']);
      expect(result.permissions).toEqual([
        { action: 'read', subject: 'users', condition: null },
        { action: 'read', subject: 'employees', condition: null },
      ]);
    });

    it("carries a RolePermission's own condition through to the mapped permissions", async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          {
            userId: 1,
            roleId: 1,
            role: {
              ...employeeRole,
              rolePermissions: [
                {
                  roleId: 1,
                  permissionId: 3,
                  condition: { employeeId: '$self' },
                  permission: buildPermission('read', 'time-logs'),
                },
              ],
            },
          },
        ],
      });

      const result = await strategy.validate(mockPayload);

      expect(result.permissions).toEqual([
        {
          action: 'read',
          subject: 'time-logs',
          condition: { employeeId: '$self' },
        },
      ]);
    });

    it("does not leak one role's RolePermission condition onto another role's grant of the same Permission", async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          {
            userId: 1,
            roleId: 2,
            role: {
              ...employeeRole,
              id: 2,
              name: 'Manager',
              rolePermissions: [
                {
                  roleId: 2,
                  permissionId: 3,
                  condition: null,
                  permission: buildPermission('read', 'time-logs'),
                },
              ],
            },
          },
        ],
      });

      const result = await strategy.validate(mockPayload);

      expect(result.permissions).toEqual([
        { action: 'read', subject: 'time-logs', condition: null },
      ]);
    });

    it('unions permissions across every role the user holds', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userRoles: [
          { userId: 1, roleId: 1, role: employeeRole },
          {
            userId: 1,
            roleId: 2,
            role: {
              ...employeeRole,
              id: 2,
              name: 'Manager',
              rolePermissions: [
                {
                  roleId: 2,
                  permissionId: 3,
                  condition: null,
                  permission: buildPermission('read', 'time-logs'),
                },
              ],
            },
          },
        ],
      });

      const result = await strategy.validate(mockPayload);

      expect(result.roles).toEqual(['Employee', 'Manager']);
      expect(result.permissions).toEqual([
        { action: 'read', subject: 'users', condition: null },
        { action: 'read', subject: 'employees', condition: null },
        { action: 'read', subject: 'time-logs', condition: null },
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
        userRoles: [
          {
            userId: 1,
            roleId: 1,
            role: { ...employeeRole, rolePermissions: [] },
          },
        ],
      });

      const result = await strategy.validate(mockPayload);

      expect(result.permissions).toEqual([]);
    });

    it('populates managedBranches from ManagerBranch rows', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        managerBranches: [
          { userId: 1, branchId: 3 },
          { userId: 1, branchId: 4 },
        ],
      });

      const result = await strategy.validate(mockPayload);

      expect(result.managedBranches).toEqual([3, 4]);
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
