import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { JwtTokenService } from './jwt-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let jwtTokenService: JwtTokenService;
  let refreshTokenService: RefreshTokenService;
  let testUser: User;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            role: {
              findMany: jest
                .fn()
                .mockResolvedValue([{ id: 1, name: 'employee' }]),
            },
            branch: {
              findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'main' }]),
            },
            passwordResetToken: {
              findFirst: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            employee: {
              create: jest.fn(),
            },
            userRole: {
              createMany: jest.fn(),
            },
            employeeBranch: {
              createMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            createRefreshToken: jest.fn(),
            validateRefreshToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
            rotateRefreshToken: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        {
          provide: JwtTokenService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            hashToken: jest.fn(),
            parseExpirationTime: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_SECRET: 'test-jwt-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    jwtTokenService = module.get<JwtTokenService>(JwtTokenService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);

    // Mock test user
    testUser = {
      id: 1,
      username: 'testuser',
      password: await bcrypt.hash('testpassword', 10),
      employeeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        username: 'newuser',
        password: 'password123',
        fullName: 'New User',
        phoneNumber: '1234567890',
        email: 'newuser@example.com',
        address: '123 Main St',
        dateOfBirth: new Date('1990-01-01'),
        probationStartDate: new Date(),
        officialStartDate: new Date(),
        roleIds: [1],
        branchIds: [1],
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.$transaction as jest.Mock).mockResolvedValue({
        user: { id: 1, username: 'newuser', employeeId: 1 },
        employee: { id: 1 },
      });

      const result = await service.register(registerDto);

      expect(result).toBeDefined();
      expect(result.username).toBe('newuser');
    });

    it('should throw error if username already exists', async () => {
      const registerDto = {
        username: 'existinguser',
        password: 'password123',
        fullName: 'Existing User',
        phoneNumber: '1234567890',
        email: 'existing@example.com',
        address: '123 Main St',
        dateOfBirth: new Date('1990-01-01'),
        probationStartDate: new Date(),
        officialStartDate: new Date(),
        roleIds: [1],
        branchIds: [1],
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(testUser);

      await expect(service.register(registerDto)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';
      const mockTokenRecord = {
        id: 'token-id-123',
        userId: testUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      (jwtTokenService.generateAccessToken as jest.Mock).mockReturnValue(
        mockAccessToken,
      );
      (refreshTokenService.createRefreshToken as jest.Mock).mockResolvedValue({
        token: mockRefreshToken,
        tokenRecord: mockTokenRecord,
      });

      const result = await service.login(testUser);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });

      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith({
        sub: testUser.id,
        email: testUser.username,
        roles: ['employee'],
      });
      expect(refreshTokenService.createRefreshToken).toHaveBeenCalledWith(
        testUser.id,
        {
          sub: testUser.id,
          email: testUser.username,
          roles: ['employee'],
        },
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const mockAccessToken = 'new-access-token';
      const mockNewRefreshToken = 'new-refresh-token';
      const mockRefreshSession = {
        id: testUser.id,
        username: testUser.username,
        roles: ['employee'],
        tokenId: 'old-token-id',
      };

      (jwtTokenService.generateAccessToken as jest.Mock).mockReturnValue(
        mockAccessToken,
      );
      (refreshTokenService.rotateRefreshToken as jest.Mock).mockResolvedValue({
        token: mockNewRefreshToken,
      });

      const result = await service.refreshToken(mockRefreshSession);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockNewRefreshToken,
      });

      expect(jwtTokenService.generateAccessToken).toHaveBeenCalledWith({
        sub: testUser.id,
        email: testUser.username,
        roles: ['employee'],
      });
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old-token-id',
        {
          sub: testUser.id,
          email: testUser.username,
          roles: ['employee'],
        },
      );
    });

    it('should handle token rotation failure', async () => {
      const mockRefreshSession = {
        id: testUser.id,
        username: testUser.username,
        roles: ['employee'],
        tokenId: 'old-token-id',
      };

      (jwtTokenService.generateAccessToken as jest.Mock).mockReturnValue(
        'access-token',
      );
      (refreshTokenService.rotateRefreshToken as jest.Mock).mockRejectedValue(
        new Error('Token rotation failed'),
      );

      await expect(service.refreshToken(mockRefreshSession)).rejects.toThrow(
        'Token rotation failed',
      );

      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old-token-id',
        {
          sub: testUser.id,
          email: testUser.username,
          roles: ['employee'],
        },
      );
    });
  });

  describe('logout', () => {
    it('should logout user by revoking refresh token', async () => {
      const refreshToken = 'refresh-token-to-revoke';
      const mockValidationResult = {
        user: testUser,
        tokenRecord: {
          id: 'token-id-to-revoke',
          userId: testUser.id,
          tokenHash: 'hashed-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
      };

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(
        mockValidationResult,
      );
      (refreshTokenService.revokeRefreshToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.logout(refreshToken, testUser.id);

      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(
        refreshToken,
        testUser.id,
      );
      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        mockValidationResult.tokenRecord.id,
      );
    });

    it('should throw UnauthorizedException for invalid refresh token during logout', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.logout(invalidRefreshToken, testUser.id),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should generate password reset token', async () => {
      const email = 'test@example.com';
      const mockUser = { ...testUser, email };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.forgotPassword(email);

      expect(result).toEqual({ message: 'Password reset token sent to email' });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should throw error if user not found', async () => {
      const email = 'nonexistent@example.com';

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.forgotPassword(email)).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const token = 'valid-reset-token';
      const newPassword = 'newpassword123';
      const mockUser = {
        ...testUser,
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.resetPassword(token, newPassword);

      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw error for invalid or expired token', async () => {
      const token = 'invalid-token';
      const newPassword = 'newpassword123';

      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete registration and login flow', async () => {
      const registerDto = {
        username: 'newuser',
        password: 'password123',
        fullName: 'New User',
        phoneNumber: '1234567890',
        email: 'newuser@example.com',
        address: '123 Main St',
        dateOfBirth: new Date('1990-01-01'),
        probationStartDate: new Date(),
        officialStartDate: new Date(),
        roleIds: [1],
        branchIds: [1],
      };

      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';
      const mockUser = { id: 1, username: 'newuser', employeeId: 1 };

      // Mock registration
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.$transaction as jest.Mock).mockResolvedValue({
        user: mockUser,
        employee: { id: 1 },
      });

      // Mock login
      (jwtTokenService.generateAccessToken as jest.Mock).mockReturnValue(
        mockAccessToken,
      );
      (refreshTokenService.createRefreshToken as jest.Mock).mockResolvedValue({
        token: mockRefreshToken,
      });

      // Register user
      const registeredUser = await service.register(registerDto);
      expect(registeredUser).toBeDefined();
      expect(registeredUser.username).toBe('newuser');

      // Login user
      const loginResult = await service.login(mockUser as any);
      expect(loginResult.accessToken).toBe(mockAccessToken);
      expect(loginResult.refreshToken).toBe(mockRefreshToken);
    });

    it('should handle token refresh flow', async () => {
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      const mockRefreshSession = {
        id: testUser.id,
        username: testUser.username,
        roles: ['employee'],
        tokenId: 'old-token-id',
      };

      (jwtTokenService.generateAccessToken as jest.Mock).mockReturnValue(
        newAccessToken,
      );
      (refreshTokenService.rotateRefreshToken as jest.Mock).mockResolvedValue({
        token: newRefreshToken,
      });

      const result = await service.refreshToken(mockRefreshSession);

      expect(result.accessToken).toBe(newAccessToken);
      expect(result.refreshToken).toBe(newRefreshToken);
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old-token-id',
        {
          sub: testUser.id,
          email: testUser.username,
          roles: ['employee'],
        },
      );
    });
  });
});
