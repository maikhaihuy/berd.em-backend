import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
          useFactory: async (configService: ConfigService) => ({
            secret:
              configService.get<string>('JWT_ACCESS_SECRET') || 'test-secret',
            signOptions: { expiresIn: '15m' },
          }),
          inject: [ConfigService],
        }),
        PrismaModule,
      ],
      providers: [
        AuthService,
        RefreshTokenService,
        LocalStrategy,
        JwtAccessStrategy,
        JwtRefreshStrategy,
      ],
      exports: [AuthService, RefreshTokenService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanup();
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
      const userCount = await prismaService.user.count();
      expect(typeof userCount).toBe('number');
    });

    it('should access RefreshToken model', async () => {
      const tokenCount = await prismaService.refreshToken.count();
      expect(typeof tokenCount).toBe('number');
    });

    it('should handle User-RefreshToken relation', async () => {
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
      const testToken = await prismaService.refreshToken.create({
        data: {
          userId: testUser.id,
          tokenHash: await bcrypt.hash('test-token', 10),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Verify token exists
      const tokenExists = await prismaService.refreshToken.findUnique({
        where: { id: testToken.id },
      });
      expect(tokenExists).toBeDefined();

      // Delete user and verify cascade
      await prismaService.user.delete({ where: { id: testUser.id } });
      const tokenAfterUserDelete = await prismaService.refreshToken.findUnique({
        where: { id: testToken.id },
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
      await prismaService.user.delete({ where: { id: testUser.id } });
    });

    it('should generate refresh token', async () => {
      const result = await refreshTokenService.createRefreshToken(testUser.id);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.tokenRecord).toBeDefined();
      expect(result.tokenRecord.userId).toBe(testUser.id);
      expect(result.tokenRecord.tokenHash).toBeDefined();
      expect(result.tokenRecord.expiresAt).toBeInstanceOf(Date);
    });

    it('should validate refresh token', async () => {
      const { token, tokenRecord } =
        await refreshTokenService.createRefreshToken(testUser.id);

      const validationResult = await refreshTokenService.validateRefreshToken(
        token,
        testUser.id,
      );

      expect(validationResult).toBeDefined();
      expect(validationResult.user.id).toBe(testUser.id);
      expect(validationResult.tokenRecord.id).toBe(tokenRecord.id);
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid-token';

      const validationResult = await refreshTokenService.validateRefreshToken(
        invalidToken,
        testUser.id,
      );

      expect(validationResult).toBeNull();
    });

    it('should revoke refresh token', async () => {
      const { tokenRecord } = await refreshTokenService.createRefreshToken(
        testUser.id,
      );

      await refreshTokenService.revokeRefreshToken(tokenRecord.id);

      const revokedToken = await prismaService.refreshToken.findUnique({
        where: { id: tokenRecord.id },
      });

      expect(revokedToken.revokedAt).toBeDefined();
      expect(revokedToken.revokedAt).toBeInstanceOf(Date);
    });

    it('should revoke all user tokens', async () => {
      // Create multiple tokens
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        const result = await refreshTokenService.createRefreshToken(
          testUser.id,
        );
        tokens.push(result.tokenRecord);
      }

      await refreshTokenService.revokeAllUserTokens(testUser.id);

      // Check all tokens are revoked
      for (const token of tokens) {
        const revokedToken = await prismaService.refreshToken.findUnique({
          where: { id: token.id },
        });
        expect(revokedToken.revokedAt).toBeDefined();
      }
    });

    it('should rotate refresh token', async () => {
      const { token: oldToken, tokenRecord: oldTokenRecord } =
        await refreshTokenService.createRefreshToken(testUser.id);

      const { token: newToken, tokenRecord: newTokenRecord } =
        await refreshTokenService.rotateRefreshToken(
          oldTokenRecord.id,
          testUser.id,
        );

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
      expect(newTokenRecord.id).not.toBe(oldTokenRecord.id);

      // Check old token is revoked
      const oldTokenAfterRotation = await prismaService.refreshToken.findUnique(
        {
          where: { id: oldTokenRecord.id },
        },
      );
      expect(oldTokenAfterRotation.revokedAt).toBeDefined();
    });

    it('should get user active tokens', async () => {
      // Create multiple tokens
      const activeTokens = [];
      for (let i = 0; i < 3; i++) {
        const result = await refreshTokenService.createRefreshToken(
          testUser.id,
        );
        activeTokens.push(result.tokenRecord);
      }

      // Revoke one token
      await refreshTokenService.revokeRefreshToken(activeTokens[0].id);

      const userActiveTokens = await refreshTokenService.getUserActiveTokens(
        testUser.id,
      );

      expect(userActiveTokens).toHaveLength(2);
      expect(userActiveTokens.every((token) => token.revokedAt === null)).toBe(
        true,
      );
    });

    it('should cleanup expired tokens', async () => {
      // Create expired token
      const expiredToken = await prismaService.refreshToken.create({
        data: {
          userId: testUser.id,
          tokenHash: await bcrypt.hash('expired-token', 10),
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const deletedCount = await refreshTokenService.cleanupExpiredTokens();

      expect(deletedCount).toBeGreaterThanOrEqual(1);

      const expiredTokenAfterCleanup =
        await prismaService.refreshToken.findUnique({
          where: { id: expiredToken.id },
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
      await prismaService.user.delete({ where: { id: testUser.id } });
    });

    it('should handle multiple device sessions', async () => {
      const devices = ['mobile', 'desktop', 'tablet'];
      const deviceTokens = [];

      // Create tokens for different devices
      for (const device of devices) {
        const result = await refreshTokenService.createRefreshToken(
          testUser.id,
        );
        deviceTokens.push({ device, ...result });
      }

      expect(deviceTokens).toHaveLength(3);

      // Get all active sessions
      const activeSessions = await refreshTokenService.getUserActiveTokens(
        testUser.id,
      );
      expect(activeSessions).toHaveLength(3);
    });

    it('should support single device logout', async () => {
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const result = await refreshTokenService.createRefreshToken(
          testUser.id,
        );
        sessions.push(result);
      }

      // Logout from one device
      await refreshTokenService.revokeRefreshToken(sessions[0].tokenRecord.id);

      const remainingSessions = await refreshTokenService.getUserActiveTokens(
        testUser.id,
      );
      expect(remainingSessions).toHaveLength(2);
    });

    it('should support logout all devices', async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        await refreshTokenService.createRefreshToken(testUser.id);
      }

      // Logout from all devices
      await refreshTokenService.revokeAllUserTokens(testUser.id);

      const remainingSessions = await refreshTokenService.getUserActiveTokens(
        testUser.id,
      );
      expect(remainingSessions).toHaveLength(0);
    });
  });

  // Helper functions
  async function createTestUser() {
    const timestamp = Date.now();
    return await prismaService.user.create({
      data: {
        username: `testuser_${timestamp}`,
        password: await bcrypt.hash('testpassword', 10),
        createdBy: 1,
        updatedBy: 1,
      },
    });
  }

  async function cleanup() {
    // Clean up any test users
    await prismaService.user.deleteMany({
      where: {
        username: {
          startsWith: 'testuser_',
        },
      },
    });

    // Clean up expired or revoked tokens
    await prismaService.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
  }
});
