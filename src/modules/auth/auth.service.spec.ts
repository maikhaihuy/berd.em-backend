/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtTokenService } from './jwt-token.service';
import { PasswordService } from '../../common/services/password.service';
import { ZaloAuthService } from './zalo-auth.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { PasswordResetTokenService } from './password-reset-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    employee: { findUnique: jest.Mock; findFirst: jest.Mock };
    zaloIdentity: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let passwordService: { compare: jest.Mock; hash: jest.Mock };
  let passwordResetTokenService: {
    issueForUser: jest.Mock;
    consume: jest.Mock;
  };
  let jwtTokenService: {
    generateAccessToken: jest.Mock;
    parseExpirationTime: jest.Mock;
  };
  let refreshTokenService: {
    createRefreshToken: jest.Mock;
    rotateRefreshToken: jest.Mock;
    revokeRefreshToken: jest.Mock;
  };
  let zaloAuthService: {
    verifyAccessToken: jest.Mock;
    getPhoneNumber: jest.Mock;
  };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  const authUser = new AuthenticatedUserDto({
    userId: 1,
    phone: '0900000001',
    employeeId: 10,
    roles: ['Employee'],
    branches: [5],
    managedBranches: [],
    permissions: [],
  });

  beforeEach(async () => {
    prismaService = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn(), findFirst: jest.fn() },
      zaloIdentity: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    passwordService = { compare: jest.fn(), hash: jest.fn() };
    jwtTokenService = {
      generateAccessToken: jest.fn(),
      parseExpirationTime: jest.fn(),
    };
    refreshTokenService = {
      createRefreshToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
    };
    zaloAuthService = {
      verifyAccessToken: jest.fn(),
      getPhoneNumber: jest.fn(),
    };
    passwordResetTokenService = {
      issueForUser: jest.fn(),
      consume: jest.fn(),
    };
    configService = { get: jest.fn(), getOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtTokenService, useValue: jwtTokenService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        {
          provide: PasswordService,
          useValue: passwordService,
        },
        { provide: ZaloAuthService, useValue: zaloAuthService },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: PasswordResetTokenService,
          useValue: passwordResetTokenService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('re-fetches the User fresh and generates an access/refresh token pair fully populated from it', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        phoneNumber: '0900000001',
        status: 'ACTIVE',
        mustChangePassword: true,
        userRoles: [{ role: { name: 'Employee' } }],
        managerBranches: [],
        employee: { id: 10 },
      });
      prismaService.employee.findUnique.mockResolvedValue({
        id: 10,
        employeeBranches: [{ branch: { id: 5 } }],
      });
      jwtTokenService.generateAccessToken.mockReturnValue('access-token');
      refreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'refresh-token',
        tokenRecord: {},
      });

      const result = await service.login(authUser);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: authUser.userId } }),
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith({
        sub: 1,
        typ: 'access',
        phone: '0900000001',
        empId: 10,
        roles: ['Employee'],
        branches: [5],
        managedBranches: [],
        mustChangePassword: true,
      });
      expect(refreshTokenService.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 1,
          roles: ['Employee'],
          mustChangePassword: true,
        }),
      );
    });

    it('throws when the User no longer exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(authUser)).rejects.toThrow('User not found');
      expect(jwtTokenService.generateAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const session = new RefreshSessionDto({
      userId: 1,
      phone: '0900000001',
      roles: ['Employee'],
      branches: [5],
      managedBranches: [],
      permissions: [],
      tokenId: 'old-token-id',
    });

    it('should rotate the refresh token and issue a new access token', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        phoneNumber: '0900000001',
        mustChangePassword: true,
        userRoles: [{ role: { name: 'Employee' } }],
        managerBranches: [],
        employee: { id: 10 },
      });
      prismaService.employee.findUnique.mockResolvedValue({
        id: 10,
        employeeBranches: [{ branch: { id: 5 } }],
      });
      jwtTokenService.generateAccessToken.mockReturnValue('new-access-token');
      refreshTokenService.rotateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
        tokenRecord: {},
      });

      const result = await service.refreshToken(session);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: true }),
      );
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old-token-id',
        expect.objectContaining({ sub: 1, roles: ['Employee'] }),
      );
    });

    it('should throw when the user no longer exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(session)).rejects.toThrow();
      expect(refreshTokenService.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('should succeed with an empty branches list when the user has no linked employee', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        phoneNumber: '0900000001',
        userRoles: [{ role: { name: 'Employee' } }],
        managerBranches: [],
        employee: null,
      });
      jwtTokenService.generateAccessToken.mockReturnValue('new-access-token');
      refreshTokenService.rotateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
        tokenRecord: {},
      });

      const result = await service.refreshToken(session);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(prismaService.employee.findUnique).not.toHaveBeenCalled();
      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ branches: [] }),
      );
    });

    it('should still throw when the linked employee id does not resolve to a row', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        phoneNumber: '0900000001',
        userRoles: [{ role: { name: 'Employee' } }],
        managerBranches: [],
        employee: { id: 10 },
      });
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(session)).rejects.toThrow(
        'Employee record not found for user',
      );
      expect(refreshTokenService.rotateRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the given refresh token id', async () => {
      refreshTokenService.revokeRefreshToken.mockResolvedValue(undefined);

      await service.logout('token-id-123');

      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'token-id-123',
      );
    });
  });

  describe('loginWithZalo', () => {
    it('should reject an invalid Zalo access token', async () => {
      zaloAuthService.verifyAccessToken.mockResolvedValue({
        zaloUserId: undefined,
      });

      await expect(
        service.loginWithZalo({ accessToken: 'bad' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('generates an access token carrying mustChangePassword for an existing linked identity', async () => {
      zaloAuthService.verifyAccessToken.mockResolvedValue({
        zaloUserId: 'zalo-1',
        fullName: 'Zalo User',
        avatarUrl: null,
      });
      prismaService.zaloIdentity.findUnique.mockResolvedValue({
        id: 1,
        user: {
          id: 1,
          phoneNumber: '0900000001',
          status: 'ACTIVE',
          mustChangePassword: true,
          userRoles: [{ role: { name: 'Employee' } }],
          managerBranches: [],
          employee: null,
        },
      });
      prismaService.zaloIdentity.update.mockResolvedValue({});
      jwtTokenService.generateAccessToken.mockReturnValue('zalo-access-token');
      refreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'zalo-refresh-token',
        tokenRecord: {},
      });

      await service.loginWithZalo({ accessToken: 'good' });

      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: true }),
      );
    });
  });

  describe('loginWithDev', () => {
    const devLoginDto = { employeeId: 42 };

    beforeEach(() => {
      const configValues: Record<string, string> = {
        NODE_ENV: 'development',
        AUTH_DEV_MODE: 'true',
        AUTH_DEV_SECRET: 'dev-secret',
      };
      configService.get.mockImplementation((key: string) => configValues[key]);
      configService.getOrThrow.mockImplementation(
        (key: string) => configValues[key],
      );
      jwtTokenService.parseExpirationTime.mockReturnValue(3600000);
    });

    it('generates an access token carrying mustChangePassword for the dev employee', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        id: 42,
        fullName: 'Dev Employee',
        avatar: null,
        employeeBranches: [{ branch: { id: 7 } }],
        user: {
          id: 1,
          phoneNumber: '0900000001',
          avatarUrl: null,
          status: 'ACTIVE',
          mustChangePassword: true,
          userRoles: [{ role: { name: 'Employee', rolePermissions: [] } }],
          managerBranches: [],
        },
      });
      jwtTokenService.generateAccessToken.mockReturnValue('dev-access-token');
      refreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'dev-refresh-token',
        tokenRecord: {},
      });

      await service.loginWithDev(devLoginDto, 'dev-secret');

      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: true }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('issues a reset token when the username matches a user', async () => {
      prismaService.user.findUnique.mockResolvedValue({ id: 1 });

      await service.forgotPassword('0900000001');

      expect(passwordResetTokenService.issueForUser).toHaveBeenCalledWith(1);
    });

    it('does nothing (but still resolves) when the username has no match', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword('0900000000'),
      ).resolves.toBeUndefined();
      expect(passwordResetTokenService.issueForUser).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('delegates to PasswordResetTokenService.consume', async () => {
      passwordResetTokenService.consume.mockResolvedValue(undefined);

      await service.resetPassword('raw-token', 'newPassword123');

      expect(passwordResetTokenService.consume).toHaveBeenCalledWith(
        'raw-token',
        'newPassword123',
      );
    });
  });

  describe('changePassword', () => {
    it('hashes and persists the new password and clears mustChangePassword on a correct current password', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        password: 'stored-hash',
      });
      passwordService.compare.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue('new-hash');

      await service.changePassword(1, 'currentPassword123', 'newPassword123');

      expect(passwordService.compare).toHaveBeenCalledWith(
        'currentPassword123',
        'stored-hash',
      );
      expect(passwordService.hash).toHaveBeenCalledWith('newPassword123');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          password: 'new-hash',
          mustChangePassword: false,
          mustChangePasswordExpiresAt: null,
        },
      });
    });

    it('rejects and leaves state unchanged when the current password does not match', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        password: 'stored-hash',
      });
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.changePassword(1, 'wrongPassword', 'newPassword123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('linkZalo', () => {
    it('creates a ZaloIdentity for the caller when the token is valid', async () => {
      zaloAuthService.verifyAccessToken.mockResolvedValue({
        zaloUserId: 'zalo-123',
        fullName: 'Test User',
        avatarUrl: null,
      });
      prismaService.zaloIdentity.create.mockResolvedValue({});

      await service.linkZalo(1, 'valid-token');

      expect(prismaService.zaloIdentity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            zaloUserId: 'zalo-123',
          }),
        }),
      );
    });

    it('rejects an invalid Zalo access token', async () => {
      zaloAuthService.verifyAccessToken.mockResolvedValue({
        zaloUserId: undefined,
      });

      await expect(service.linkZalo(1, 'bad')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaService.zaloIdentity.create).not.toHaveBeenCalled();
    });

    it('rejects when the caller already has a linked Zalo identity', async () => {
      zaloAuthService.verifyAccessToken.mockResolvedValue({
        zaloUserId: 'zalo-123',
        fullName: 'Test User',
        avatarUrl: null,
      });
      prismaService.zaloIdentity.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.13.0',
          meta: { target: ['userId'] },
        }),
      );

      await expect(service.linkZalo(1, 'valid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when the Zalo identity is already linked to a different user', async () => {
      zaloAuthService.verifyAccessToken.mockResolvedValue({
        zaloUserId: 'zalo-123',
        fullName: 'Test User',
        avatarUrl: null,
      });
      prismaService.zaloIdentity.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.13.0',
          meta: { target: ['zaloUserId'] },
        }),
      );

      await expect(service.linkZalo(1, 'valid-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
