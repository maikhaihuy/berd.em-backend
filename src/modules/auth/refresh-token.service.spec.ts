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
    email: 'test@example.com',
    roles: ['employee'],
    jti: undefined, // Will be set by the service
  };

  const mockTokenRecord: RefreshToken = {
    id: 'test-token-id',
    userId: 1,
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

      jest.spyOn(configService, 'get').mockReturnValue('7d');
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

      expect(configService.get).toHaveBeenCalledWith(
        'JWT_REFRESH_EXPIRATION',
        '7d',
      );
      expect(jwtTokenService.parseExpirationTime).toHaveBeenCalledWith('7d');
      expect(jwtTokenService.generateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockRefreshTokenPayload,
          jti: expect.any(String),
        }),
      );
      expect(jwtTokenService.hashToken).toHaveBeenCalledWith(mockToken);
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          device: expect.any(String),
          ipAddress: expect.any(String),
          userId: mockRefreshTokenPayload.sub,
          hashedToken: mockHashedToken,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors during token creation', async () => {
      const mockToken = 'generated-refresh-token';
      const mockHashedToken = 'hashed-token';
      const mockExpirationTime = 7 * 24 * 60 * 60 * 1000;
      const dbError = new Error('Database connection failed');

      jest.spyOn(configService, 'get').mockReturnValue('7d');
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
      const mockDeleteResult = { count: 3 };

      jest
        .spyOn(prismaService.refreshToken, 'deleteMany')
        .mockResolvedValue(mockDeleteResult);

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
        {
          id: 'token-1',
          userId: userId,
          device: 'test-device',
          ipAddress: 'test-ip',
          hashedToken: 'hash-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
        {
          id: 'token-2',
          userId: userId,
          device: 'test-device',
          ipAddress: 'test-ip',
          hashedToken: 'hash-2',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
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
      const mockExpirationTime = 7 * 24 * 60 * 60 * 1000;

      // Mock the revoke operation
      jest
        .spyOn(prismaService.refreshToken, 'delete')
        .mockResolvedValue(mockTokenRecord);

      // Mock the create operation
      jest.spyOn(configService, 'get').mockReturnValue('7d');
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

      const result = await service.rotateRefreshToken(
        oldTokenId,
        mockRefreshTokenPayload,
      );

      expect(result).toEqual({
        token: mockToken,
        tokenRecord: mockTokenRecord,
      });

      // Verify old token was deleted
      expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: oldTokenId },
      });

      // Verify new token was created
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          device: expect.any(String),
          ipAddress: expect.any(String),
          userId: mockRefreshTokenPayload.sub,
          hashedToken: mockHashedToken,
          expiresAt: expect.any(Date),
        },
      });
    });
  });
});
