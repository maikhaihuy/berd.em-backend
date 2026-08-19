/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { JwtTokenService } from './jwt-token.service';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenPayloadDto } from './dto/refresh-token-payload.dto';
import { RefreshToken } from '@prisma/client';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prismaService: PrismaService;
  let jwtTokenService: JwtTokenService;
  let configService: ConfigService;

  const mockRefreshTokenPayload: RefreshTokenPayloadDto = {
    sub: 1,
    phone: '0900000001',
    role: 'Employee',
    branches: [],
  };

  const mockTokenRecord: RefreshToken = {
    id: 'test-token-id',
    userId: 1,
    source: null,
    device: 'test-device',
    ipAddress: 'test-ip',
    hashedToken: 'hashed-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              create: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtTokenService,
          useValue: {
            generateRefreshToken: jest.fn(),
            hashToken: jest.fn(),
            parseExpirationTime: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtTokenService = module.get<JwtTokenService>(JwtTokenService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRefreshToken', () => {
    it('should create a new refresh token successfully', async () => {
      const mockToken = 'generated-refresh-token';
      const mockHashedToken = 'hashed-token';
      const mockExpirationTime = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

      jest.spyOn(configService, 'getOrThrow').mockReturnValue('7d');
      jest
        .spyOn(jwtTokenService, 'parseExpirationTime')
        .mockReturnValue(mockExpirationTime);
      jest
        .spyOn(jwtTokenService, 'generateRefreshToken')
        .mockReturnValue(mockToken);
      jest
        .spyOn(jwtTokenService, 'hashToken')
        .mockResolvedValue(mockHashedToken);
      jest
        .spyOn(prismaService.refreshToken, 'create')
        .mockResolvedValue(mockTokenRecord);

      const result = await service.createRefreshToken(mockRefreshTokenPayload);

      expect(result).toEqual({
        token: mockToken,
        tokenRecord: mockTokenRecord,
      });

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_EXPIRATION',
      );
      expect(jwtTokenService.parseExpirationTime).toHaveBeenCalledWith('7d');
      expect(jwtTokenService.generateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockRefreshTokenPayload.sub,
          jti: expect.any(String),
        }),
      );
      expect(jwtTokenService.hashToken).toHaveBeenCalledWith(mockToken);
      // No context passed -> no device/ipAddress/source in the create data
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          userId: mockRefreshTokenPayload.sub,
          hashedToken: mockHashedToken,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should persist session context when provided', async () => {
      const mockToken = 'generated-refresh-token';
      jest.spyOn(configService, 'getOrThrow').mockReturnValue('7d');
      jest.spyOn(jwtTokenService, 'parseExpirationTime').mockReturnValue(1000);
      jest
        .spyOn(jwtTokenService, 'generateRefreshToken')
        .mockReturnValue(mockToken);
      jest.spyOn(jwtTokenService, 'hashToken').mockResolvedValue('hashed');
      jest
        .spyOn(prismaService.refreshToken, 'create')
        .mockResolvedValue(mockTokenRecord);

      await service.createRefreshToken(mockRefreshTokenPayload, {
        source: 'zalo',
        userAgent: 'jest-agent',
        ipAddress: '127.0.0.1',
      });

      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'zalo',
          device: 'jest-agent',
          ipAddress: '127.0.0.1',
        }),
      });
    });

    it('should handle database errors during token creation', async () => {
      const dbError = new Error('Database connection failed');

      jest.spyOn(configService, 'getOrThrow').mockReturnValue('7d');
      jest.spyOn(jwtTokenService, 'parseExpirationTime').mockReturnValue(1000);
      jest
        .spyOn(jwtTokenService, 'generateRefreshToken')
        .mockReturnValue('token');
      jest.spyOn(jwtTokenService, 'hashToken').mockResolvedValue('hashed');
      jest
        .spyOn(prismaService.refreshToken, 'create')
        .mockRejectedValue(dbError);

      await expect(
        service.createRefreshToken(mockRefreshTokenPayload),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a refresh token', async () => {
      const tokenId = 'token-id-123';

      jest
        .spyOn(prismaService.refreshToken, 'delete')
        .mockResolvedValue(mockTokenRecord);

      await service.revokeRefreshToken(tokenId);

      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: tokenId },
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', async () => {
      const userId = 1;

      jest
        .spyOn(prismaService.refreshToken, 'deleteMany')
        .mockResolvedValue({ count: 3 });

      await service.revokeAllUserTokens(userId);

      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('getUserActiveTokens', () => {
    it('should return active tokens for user', async () => {
      const userId = 1;
      const mockTokens: RefreshToken[] = [
        { ...mockTokenRecord, id: 'token-1', hashedToken: 'hash-1' },
        { ...mockTokenRecord, id: 'token-2', hashedToken: 'hash-2' },
      ];

      jest
        .spyOn(prismaService.refreshToken, 'findMany')
        .mockResolvedValue(mockTokens);

      const result = await service.getUserActiveTokens(userId);

      expect(result).toEqual(mockTokens);
      expect(prismaService.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          expiresAt: { gte: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    it('should rotate refresh token successfully', async () => {
      const oldTokenId = 'old-token-id';
      const mockToken = 'new-refresh-token';
      const mockHashedToken = 'new-hashed-token';

      jest
        .spyOn(prismaService.refreshToken, 'delete')
        .mockResolvedValue(mockTokenRecord);
      jest.spyOn(configService, 'getOrThrow').mockReturnValue('7d');
      jest.spyOn(jwtTokenService, 'parseExpirationTime').mockReturnValue(1000);
      jest
        .spyOn(jwtTokenService, 'generateRefreshToken')
        .mockReturnValue(mockToken);
      jest
        .spyOn(jwtTokenService, 'hashToken')
        .mockResolvedValue(mockHashedToken);
      jest
        .spyOn(prismaService.refreshToken, 'create')
        .mockResolvedValue(mockTokenRecord);

      const result = await service.rotateRefreshToken(
        oldTokenId,
        mockRefreshTokenPayload,
      );

      expect(result).toEqual({
        token: mockToken,
        tokenRecord: mockTokenRecord,
      });
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: oldTokenId },
      });
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          userId: mockRefreshTokenPayload.sub,
          hashedToken: mockHashedToken,
          expiresAt: expect.any(Date),
        },
      });
    });
  });
});
