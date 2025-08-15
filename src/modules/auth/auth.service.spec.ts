import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
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
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            generateRefreshToken: jest.fn(),
            validateRefreshToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
            getUserActiveTokens: jest.fn(),
            rotateRefreshToken: jest.fn(),
            cleanupExpiredTokens: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_SECRET: 'test-jwt-secret',
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
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);

    // Mock test user
    testUser = {
      id: 1,
      username: 'testuser',
      password: await bcrypt.hash('testpassword', 10),
      employeeId: null,
      hashedRefreshToken: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 1,
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(testUser);

      const result = await service.validateUser('testuser', 'testpassword');

      expect(result).toBeDefined();
      expect(result.id).toBe(testUser.id);
      expect(result.username).toBe(testUser.username);
      expect(result.password).toBeUndefined(); // Password should be excluded
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should return null for invalid username', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser('invaliduser', 'testpassword');

      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(testUser);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
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

      (jwtService.sign as jest.Mock).mockReturnValue(mockAccessToken);
      (refreshTokenService.generateRefreshToken as jest.Mock).mockResolvedValue({
        token: mockRefreshToken,
        tokenRecord: mockTokenRecord,
      });

      const result = await service.login(testUser);

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
        user: {
          id: testUser.id,
          username: testUser.username,
          employeeId: testUser.employeeId,
        },
      });

      expect(jwtService.sign).toHaveBeenCalledWith({
        username: testUser.username,
        sub: testUser.id,
      });
      expect(refreshTokenService.generateRefreshToken).toHaveBeenCalledWith(testUser.id);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const mockAccessToken = 'new-access-token';
      const mockNewRefreshToken = 'new-refresh-token';
      const mockTokenRecord = {
        id: 'new-token-id',
        userId: testUser.id,
        tokenHash: 'new-hashed-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      const mockValidationResult = {
        user: testUser,
        tokenRecord: {
          id: 'old-token-id',
          userId: testUser.id,
          tokenHash: 'old-hashed-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
      };

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(mockValidationResult);
      (jwtService.sign as jest.Mock).mockReturnValue(mockAccessToken);
      (refreshTokenService.rotateRefreshToken as jest.Mock).mockResolvedValue({
        token: mockNewRefreshToken,
        tokenRecord: mockTokenRecord,
      });

      const result = await service.refreshTokens(oldRefreshToken, testUser.id);

      expect(result).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockNewRefreshToken,
        user: {
          id: testUser.id,
          username: testUser.username,
          employeeId: testUser.employeeId,
        },
      });

      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(oldRefreshToken, testUser.id);
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        mockValidationResult.tokenRecord.id,
        testUser.id
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(null);

      await expect(service.refreshTokens(invalidRefreshToken, testUser.id))
        .rejects
        .toThrow(UnauthorizedException);

      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(invalidRefreshToken, testUser.id);
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

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(mockValidationResult);
      (refreshTokenService.revokeRefreshToken as jest.Mock).mockResolvedValue(undefined);

      await service.logout(refreshToken, testUser.id);

      expect(refreshTokenService.validateRefreshToken).toHaveBeenCalledWith(refreshToken, testUser.id);
      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(mockValidationResult.tokenRecord.id);
    });

    it('should throw UnauthorizedException for invalid refresh token during logout', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(null);

      await expect(service.logout(invalidRefreshToken, testUser.id))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('logoutFromAllDevices', () => {
    it('should logout user from all devices', async () => {
      (refreshTokenService.revokeAllUserTokens as jest.Mock).mockResolvedValue(undefined);

      await service.logoutFromAllDevices(testUser.id);

      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(testUser.id);
    });
  });

  describe('getUserActiveSessions', () => {
    it('should return user active sessions', async () => {
      const mockActiveSessions = [
        {
          id: 'session-1',
          userId: testUser.id,
          tokenHash: 'hash-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
        {
          id: 'session-2',
          userId: testUser.id,
          tokenHash: 'hash-2',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
      ];

      (refreshTokenService.getUserActiveTokens as jest.Mock).mockResolvedValue(mockActiveSessions);

      const result = await service.getUserActiveSessions(testUser.id);

      expect(result).toEqual(mockActiveSessions.map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })));

      expect(refreshTokenService.getUserActiveTokens).toHaveBeenCalledWith(testUser.id);
    });

    it('should return empty array when user has no active sessions', async () => {
      (refreshTokenService.getUserActiveTokens as jest.Mock).mockResolvedValue([]);

      const result = await service.getUserActiveSessions(testUser.id);

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      const mockCleanupCount = 5;

      (refreshTokenService.cleanupExpiredTokens as jest.Mock).mockResolvedValue(mockCleanupCount);

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(mockCleanupCount);
      expect(refreshTokenService.cleanupExpiredTokens).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete login flow', async () => {
      // Simulate complete login flow
      const username = 'testuser';
      const password = 'testpassword';
      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';
      const mockTokenRecord = {
        id: 'token-id',
        userId: testUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      // Mock user validation
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(testUser);
      
      // Mock token generation
      (jwtService.sign as jest.Mock).mockReturnValue(mockAccessToken);
      (refreshTokenService.generateRefreshToken as jest.Mock).mockResolvedValue({
        token: mockRefreshToken,
        tokenRecord: mockTokenRecord,
      });

      // Validate user
      const validatedUser = await service.validateUser(username, password);
      expect(validatedUser).toBeDefined();
      expect(validatedUser.username).toBe(username);

      // Login user
      const loginResult = await service.login(validatedUser);
      expect(loginResult.access_token).toBe(mockAccessToken);
      expect(loginResult.refresh_token).toBe(mockRefreshToken);
      expect(loginResult.user.id).toBe(testUser.id);
    });

    it('should handle token refresh flow', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      
      const mockValidationResult = {
        user: testUser,
        tokenRecord: {
          id: 'old-token-id',
          userId: testUser.id,
          tokenHash: 'old-hash',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
      };

      const mockNewTokenRecord = {
        id: 'new-token-id',
        userId: testUser.id,
        tokenHash: 'new-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      (refreshTokenService.validateRefreshToken as jest.Mock).mockResolvedValue(mockValidationResult);
      (jwtService.sign as jest.Mock).mockReturnValue(newAccessToken);
      (refreshTokenService.rotateRefreshToken as jest.Mock).mockResolvedValue({
        token: newRefreshToken,
        tokenRecord: mockNewTokenRecord,
      });

      const result = await service.refreshTokens(oldRefreshToken, testUser.id);

      expect(result.access_token).toBe(newAccessToken);
      expect(result.refresh_token).toBe(newRefreshToken);
      expect(refreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        mockValidationResult.tokenRecord.id,
        testUser.id
      );
    });
  });
});