import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RefreshToken, User } from '@prisma/client';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prismaService: PrismaService;
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
        RefreshTokenService,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
              count: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Mock test user
    testUser = {
      id: 1,
      username: 'testuser',
      password: 'hashedpassword',
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

  describe('generateRefreshToken', () => {
    it('should generate a refresh token successfully', async () => {
      const mockTokenRecord: RefreshToken = {
        id: 'token-id-123',
        userId: testUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );

      const result = await service.createRefreshToken(testUser.id);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.tokenRecord).toEqual(mockTokenRecord);
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBe(64); // 32 bytes * 2 (hex)
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: testUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should set expiration to 7 days from now', async () => {
      const mockTokenRecord: RefreshToken = {
        id: 'token-id-123',
        userId: testUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );

      await service.createRefreshToken(testUser.id);

      const createCall = (prismaService.refreshToken.create as jest.Mock).mock
        .calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Allow 1 second difference for test execution time
      expect(
        Math.abs(expiresAt.getTime() - sevenDaysFromNow.getTime()),
      ).toBeLessThan(1000);
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a correct refresh token', async () => {
      const token = 'valid-token';
      const hashedToken = await bcrypt.hash(token, 10);

      const mockUser = {
        ...testUser,
        refreshTokens: [
          {
            id: 'token-id-123',
            userId: testUser.id,
            tokenHash: hashedToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            revokedAt: null,
          },
        ],
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateRefreshToken(token, testUser.id);

      expect(result).toBeDefined();
      expect(result.user).toEqual(mockUser);
      expect(result.tokenRecord).toEqual(mockUser.refreshTokens[0]);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: testUser.id },
        include: {
          refreshTokens: {
            where: {
              revokedAt: null,
              expiresAt: { gte: expect.any(Date) },
            },
          },
        },
      });
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid-token';
      const hashedToken = await bcrypt.hash('different-token', 10);

      const mockUser = {
        ...testUser,
        refreshTokens: [
          {
            id: 'token-id-123',
            userId: testUser.id,
            tokenHash: hashedToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            revokedAt: null,
          },
        ],
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateRefreshToken(token, testUser.id);

      expect(result).toBeNull();
    });

    it('should return null when user has no active tokens', async () => {
      const mockUser = {
        ...testUser,
        refreshTokens: [],
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateRefreshToken(
        'any-token',
        testUser.id,
      );

      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateRefreshToken(
        'any-token',
        testUser.id,
      );

      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a refresh token', async () => {
      const tokenId = 'token-id-123';
      const mockUpdatedToken: RefreshToken = {
        id: tokenId,
        userId: testUser.id,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: new Date(),
      };

      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue(
        mockUpdatedToken,
      );

      await service.revokeRefreshToken(tokenId);

      expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const userId = testUser.id;
      const mockUpdateResult = { count: 3 };

      (prismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue(
        mockUpdateResult,
      );

      await service.revokeAllUserTokens(userId);

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('getUserActiveTokens', () => {
    it('should return active tokens for user', async () => {
      const mockTokens: RefreshToken[] = [
        {
          id: 'token-1',
          userId: testUser.id,
          tokenHash: 'hash-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
        {
          id: 'token-2',
          userId: testUser.id,
          tokenHash: 'hash-2',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          revokedAt: null,
        },
      ];

      (prismaService.refreshToken.findMany as jest.Mock).mockResolvedValue(
        mockTokens,
      );

      const result = await service.getUserActiveTokens(testUser.id);

      expect(result).toEqual(mockTokens);
      expect(prismaService.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          revokedAt: null,
          expiresAt: { gte: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    it('should rotate refresh token successfully', async () => {
      const oldTokenId = 'old-token-id';
      const userId = testUser.id;

      const mockOldToken: RefreshToken = {
        id: oldTokenId,
        userId,
        tokenHash: 'old-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: new Date(),
      };

      const mockNewToken: RefreshToken = {
        id: 'new-token-id',
        userId,
        tokenHash: 'new-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      };

      (prismaService.refreshToken.update as jest.Mock).mockResolvedValue(
        mockOldToken,
      );
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue(
        mockNewToken,
      );

      const result = await service.rotateRefreshToken(oldTokenId, userId);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.tokenRecord).toEqual(mockNewToken);

      // Verify old token was revoked
      expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: oldTokenId },
        data: { revokedAt: expect.any(Date) },
      });

      // Verify new token was created
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired and revoked tokens', async () => {
      const mockDeleteResult = { count: 5 };

      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue(
        mockDeleteResult,
      );

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { not: null } },
          ],
        },
      });
    });

    it('should return 0 when no tokens to cleanup', async () => {
      const mockDeleteResult = { count: 0 };

      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue(
        mockDeleteResult,
      );

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });
});
