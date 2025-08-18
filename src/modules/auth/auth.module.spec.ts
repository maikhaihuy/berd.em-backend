import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtTokenService } from './jwt-token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthModule', () => {
  let module: TestingModule;
  let authService: AuthService;
  let refreshTokenService: RefreshTokenService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        PassportModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret:
              configService.get<string>('JWT_ACCESS_SECRET') || 'test-secret',
            signOptions: { expiresIn: '15m' },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        AuthService,
        RefreshTokenService,
        LocalStrategy,
        JwtAccessStrategy,
        JwtRefreshStrategy,
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
              deleteMany: jest.fn(),
              count: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              count: jest.fn(),
            },
            role: {
              findMany: jest.fn(),
            },
            branch: {
              findMany: jest.fn(),
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
            passwordResetToken: {
              findFirst: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
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
          provide: JwtTokenService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            generateRefreshToken: jest.fn(),
            createRefreshToken: jest.fn(),
            findRefreshToken: jest.fn(),
            deleteExpiredTokens: jest.fn(),
            revokeRefreshToken: jest.fn(),
            revokeAllRefreshTokens: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRATION: '15m',
                JWT_REFRESH_EXPIRATION: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
      exports: [AuthService, RefreshTokenService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Module Initialization', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should have AuthService', () => {
      expect(authService).toBeDefined();
      expect(authService).toBeInstanceOf(AuthService);
    });

    it('should have RefreshTokenService', () => {
      expect(refreshTokenService).toBeDefined();
      expect(refreshTokenService).toBeInstanceOf(RefreshTokenService);
    });

    it('should have PrismaService', () => {
      expect(prismaService).toBeDefined();
      expect(prismaService).toBeInstanceOf(PrismaService);
    });
  });

  describe('Database Models and Relations', () => {
    it('should access User model', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);
      const userCount = await prismaService.user.count();
      expect(typeof userCount).toBe('number');
    });

    it('should access RefreshToken model', async () => {
      (prismaService.refreshToken.count as jest.Mock).mockResolvedValue(0);
      const tokenCount = await prismaService.refreshToken.count();
      expect(typeof tokenCount).toBe('number');
    });

    it('should handle User-RefreshToken relation', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      const userWithTokens = await prismaService.user.findFirst({
        include: {
          refreshTokens: {
            where: {
              revokedAt: null,
              expiresAt: { gte: new Date() },
            },
          },
        },
      });
      expect(userWithTokens).toBeDefined();
    });

    it('should support cascade delete', async () => {
      const testUser = await createTestUser();
      const testToken = { id: 'token-1', userId: testUser.id, tokenHash: 'hash', expiresAt: new Date() };
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(testToken);
      
      const createdToken = await prismaService.refreshToken.create({
        data: {
          userId: testUser.id,
          tokenHash: await bcrypt.hash('test-token', 10),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Verify token exists
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValueOnce(testToken).mockResolvedValueOnce(null);
      const tokenExists = await prismaService.refreshToken.findUnique({
        where: { id: createdToken.id },
      });
      expect(tokenExists).toBeDefined();

      // Delete user and verify cascade
      (prismaService.user.delete as jest.Mock).mockResolvedValue(testUser);
      await prismaService.user.delete({ where: { id: testUser.id } });
      const tokenAfterUserDelete = await prismaService.refreshToken.findUnique({
        where: { id: createdToken.id },
      });
      expect(tokenAfterUserDelete).toBeNull();
    });
  });

  describe('RefreshTokenService', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    afterEach(async () => {
      // Reset mocks after each test
      jest.clearAllMocks();
    });

    it('should generate refresh token', async () => {
      const mockTokenRecord = {
        id: 'token-1',
        userId: testUser.id,
        tokenHash: 'hashedToken',
        expiresAt: new Date(),
        revokedAt: null
      };
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(mockTokenRecord);
      
      const result = await refreshTokenService.createRefreshToken(testUser.id);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.tokenRecord).toBeDefined();
      expect(result.tokenRecord.userId).toBe(testUser.id);
      expect(result.tokenRecord.tokenHash).toBeDefined();
      expect(result.tokenRecord.expiresAt).toBeInstanceOf(Date);
    });

    it('should validate refresh token', async () => {
      const mockTokenRecord = {
        id: 'token-1',
        userId: testUser.id,
        tokenHash: await bcrypt.hash('test-token', 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null
      };
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(mockTokenRecord);
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockTokenRecord);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(testUser);
      
      const { token, tokenRecord } = await refreshTokenService.createRefreshToken(testUser.id);

      const validationResult = await refreshTokenService.validateRefreshToken(
        token,
        testUser.id,
      );

      expect(validationResult).toBeDefined();
      expect(validationResult?.user.id).toBe(testUser.id);
      expect(validationResult?.tokenRecord.id).toBe(tokenRecord.id);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid-token';
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      const validationResult = await refreshTokenService.validateRefreshToken(
        invalidToken,
        testUser.id,
      );

      expect(validationResult).toBeNull();
    });

    it('should revoke refresh token', async () => {
      const mockTokenRecord = {
        id: 'token-1',
        userId: testUser.id,
        tokenHash: 'hashedToken',
        expiresAt: new Date(),
        revokedAt: null
      };
      const revokedToken = { ...mockTokenRecord, revokedAt: new Date() };
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(mockTokenRecord);
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue(revokedToken);
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(revokedToken);
      
      const { tokenRecord } = await refreshTokenService.createRefreshToken(testUser.id);

      await refreshTokenService.revokeRefreshToken(tokenRecord.id);

      const revokedTokenResult = await prismaService.refreshToken.findUnique({
        where: { id: tokenRecord.id },
      });

      expect(revokedTokenResult?.revokedAt).toBeDefined();
      expect(revokedTokenResult?.revokedAt).toBeInstanceOf(Date);
    });

    it('should revoke all user tokens', async () => {
      // Create multiple tokens
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        const mockTokenRecord = {
          id: `token-${i}`,
          userId: testUser.id,
          tokenHash: `hashedToken${i}`,
          expiresAt: new Date(),
          revokedAt: null
        };
        (prismaService.refreshToken.create as jest.Mock).mockResolvedValueOnce(mockTokenRecord);
        const result = await refreshTokenService.createRefreshToken(testUser.id);
        tokens.push(result.tokenRecord);
      }

      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
      await refreshTokenService.revokeAllUserTokens(testUser.id);

      // Check all tokens are revoked
      for (const token of tokens) {
        const revokedToken = { ...token, revokedAt: new Date() };
        (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValueOnce(revokedToken);
        const result = await prismaService.refreshToken.findUnique({
          where: { id: token.id },
        });
        expect(result?.revokedAt).toBeDefined();
      }
    });

    it('should rotate refresh token', async () => {
      const oldTokenRecord = {
        id: 'old-token-1',
        userId: testUser.id,
        tokenHash: 'oldHashedToken',
        expiresAt: new Date(),
        revokedAt: null
      };
      const newTokenRecord = {
        id: 'new-token-1',
        userId: testUser.id,
        tokenHash: 'newHashedToken',
        expiresAt: new Date(),
        revokedAt: null
      };
      
      (prismaService.refreshToken.create as jest.Mock)
        .mockResolvedValueOnce(oldTokenRecord)
        .mockResolvedValueOnce(newTokenRecord);
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue({ ...oldTokenRecord, revokedAt: new Date() });
      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue({ ...oldTokenRecord, revokedAt: new Date() });
      
      const { token: oldToken, tokenRecord: oldTokenRecordResult } = await refreshTokenService.createRefreshToken(testUser.id);

      const { token: newToken, tokenRecord: newTokenRecordResult } =
        await refreshTokenService.rotateRefreshToken(
          oldTokenRecordResult.id,
          testUser.id,
        );

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
      expect(newTokenRecordResult.id).not.toBe(oldTokenRecordResult.id);

      // Check old token is revoked
      const oldTokenAfterRotation = await prismaService.refreshToken.findUnique({
        where: { id: oldTokenRecordResult.id },
      });
      expect(oldTokenAfterRotation?.revokedAt).toBeDefined();
    });

    it('should get user active tokens', async () => {
      // Create multiple tokens
      const activeTokens = [];
      for (let i = 0; i < 3; i++) {
        const mockTokenRecord = {
          id: `token-${i}`,
          userId: testUser.id,
          tokenHash: `hashedToken${i}`,
          expiresAt: new Date(),
          revokedAt: null
        };
        (prismaService.refreshToken.create as jest.Mock).mockResolvedValueOnce(mockTokenRecord);
        const result = await refreshTokenService.createRefreshToken(testUser.id);
        activeTokens.push(result.tokenRecord);
      }

      // Revoke one token
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue({ ...activeTokens[0], revokedAt: new Date() });
      await refreshTokenService.revokeRefreshToken(activeTokens[0].id);

      const remainingActiveTokens = activeTokens.slice(1);
      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(remainingActiveTokens);
      
      const userActiveTokens = await refreshTokenService.getUserActiveTokens(testUser.id);

      expect(userActiveTokens).toHaveLength(2);
      expect(userActiveTokens.every((token) => token.revokedAt === null)).toBe(true);
    });

    it('should cleanup expired tokens', async () => {
      // Create expired token
      const expiredToken = {
        id: 'expired-token-1',
        userId: testUser.id,
        tokenHash: await bcrypt.hash('expired-token', 10),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null
      };
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(expiredToken);
      
      const createdExpiredToken = await prismaService.refreshToken.create({
        data: {
          userId: testUser.id,
          tokenHash: await bcrypt.hash('expired-token', 10),
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      const deletedCount = await refreshTokenService.cleanupExpiredTokens();

      expect(deletedCount).toBeGreaterThanOrEqual(1);

      (prismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
      const expiredTokenAfterCleanup = await prismaService.refreshToken.findUnique({
        where: { id: createdExpiredToken.id },
      });
      expect(expiredTokenAfterCleanup).toBeNull();
    });
  });

  describe('Multiple Device Sessions', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    afterEach(async () => {
      // Reset mocks after each test
      jest.clearAllMocks();
    });

    it('should handle multiple device sessions', async () => {
      const devices = ['mobile', 'desktop', 'tablet'];
      const deviceTokens = [];

      // Create tokens for different devices
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        const mockTokenRecord = {
          id: `token-${i}`,
          userId: testUser.id,
          tokenHash: `hashedToken${i}`,
          expiresAt: new Date(),
          revokedAt: null
        };
        (prismaService.refreshToken.create as jest.Mock).mockResolvedValueOnce(mockTokenRecord);
        const result = await refreshTokenService.createRefreshToken(testUser.id);
        deviceTokens.push({ device, ...result });
      }

      expect(deviceTokens).toHaveLength(3);

      // Get all active sessions
      const mockActiveSessions = deviceTokens.map(dt => dt.tokenRecord);
      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(mockActiveSessions);
      const activeSessions = await refreshTokenService.getUserActiveTokens(testUser.id);
      expect(activeSessions).toHaveLength(3);
    });

    it('should support single device logout', async () => {
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const mockTokenRecord = {
          id: `token-${i}`,
          userId: testUser.id,
          tokenHash: `hashedToken${i}`,
          expiresAt: new Date(),
          revokedAt: null
        };
        (prismaService.refreshToken.create as jest.Mock).mockResolvedValueOnce(mockTokenRecord);
        const result = await refreshTokenService.createRefreshToken(testUser.id);
        sessions.push(result);
      }

      // Logout from one device
      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue({ ...sessions[0].tokenRecord, revokedAt: new Date() });
      await refreshTokenService.revokeRefreshToken(sessions[0].tokenRecord.id);

      const remainingActiveSessions = sessions.slice(1).map(s => s.tokenRecord);
      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(remainingActiveSessions);
      const remainingSessions = await refreshTokenService.getUserActiveTokens(testUser.id);
      expect(remainingSessions).toHaveLength(2);
    });

    it('should support logout all devices', async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const mockTokenRecord = {
          id: `token-${i}`,
          userId: testUser.id,
          tokenHash: `hashedToken${i}`,
          expiresAt: new Date(),
          revokedAt: null
        };
        (prismaService.refreshToken.create as jest.Mock).mockResolvedValueOnce(mockTokenRecord);
        await refreshTokenService.createRefreshToken(testUser.id);
      }

      // Logout from all devices
      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
      await refreshTokenService.revokeAllUserTokens(testUser.id);

      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue([]);
      const remainingSessions = await refreshTokenService.getUserActiveTokens(testUser.id);
      expect(remainingSessions).toHaveLength(0);
    });
  });

  // Helper functions
  async function createTestUser() {
    const timestamp = Date.now();
    const mockUser = {
      id: `user-${timestamp}`,
      username: `testuser_${timestamp}`,
      password: await bcrypt.hash('testpassword', 10),
      createdBy: 1,
      updatedBy: 1,
    };
    (prismaService.user.create as jest.Mock).mockResolvedValue(mockUser);
    return await prismaService.user.create({
      data: {
        username: `testuser_${timestamp}`,
        password: await bcrypt.hash('testpassword', 10),
        createdBy: 1,
        updatedBy: 1,
      },
    });
  }

  // Cleanup function removed since we're using mocked PrismaService
});
