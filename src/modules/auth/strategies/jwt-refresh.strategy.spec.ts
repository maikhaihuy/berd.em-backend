import { Test, TestingModule } from '@nestjs/testing';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@modules/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenPayloadDto } from '../dto/refresh-token-payload.dto';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import { Request } from 'express';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const bcrypt = require('bcrypt');

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;
  let prismaService: PrismaService;

  const mockUser = {
    id: 1,
    username: 'testuser',
    roles: [{ name: 'employee' }],
    refreshTokens: [
      {
        id: 'token-1',
        hashedToken: 'hashed-token-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'token-2',
        hashedToken: 'hashed-token-2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  };



  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                JWT_REFRESH_SECRET: 'test-refresh-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockRequest = {
      body: { refresh_token: 'test-refresh-token' },
    } as unknown as Request;

    const mockPayload: RefreshTokenPayloadDto = {
      sub: 1,
      email: 'testuser@example.com',
      roles: ['employee'],
    };

    it('should validate and return user session when token matches first record', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(result).toBeInstanceOf(RefreshSessionDto);
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
      expect(result.roles).toEqual(['employee']);
      expect(result.tokenId).toBe('token-1');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
        include: {
          roles: true,
          refreshTokens: {
            where: {
              expiresAt: { gte: expect.any(Date) },
            },
          },
        },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'test-refresh-token',
        'hashed-token-1',
      );
    });

    it('should validate and return user session when token matches second record', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(result).toBeInstanceOf(RefreshSessionDto);
      expect(result.tokenId).toBe('token-2');

      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(bcrypt.compare).toHaveBeenNthCalledWith(
        1,
        'test-refresh-token',
        'hashed-token-1',
      );
      expect(bcrypt.compare).toHaveBeenNthCalledWith(
        2,
        'test-refresh-token',
        'hashed-token-2',
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, mockPayload),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
        include: {
          roles: true,
          refreshTokens: {
            where: {
              expiresAt: { gte: expect.any(Date) },
            },
          },
        },
      });
    });

    it('should throw UnauthorizedException when no refresh token matches', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await expect(
        strategy.validate(mockRequest, mockPayload),
      ).rejects.toThrow(new UnauthorizedException('Invalid refresh token'));

      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when user has no refresh tokens', async () => {
      const userWithNoTokens = {
        ...mockUser,
        refreshTokens: [],
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithNoTokens,
      );

      await expect(
        strategy.validate(mockRequest, mockPayload),
      ).rejects.toThrow(new UnauthorizedException('Invalid refresh token'));

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should handle missing refresh_token in request body', async () => {
      const requestWithoutToken = {
        body: {},
      } as unknown as Request;

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        strategy.validate(requestWithoutToken, mockPayload),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return first matching token when multiple tokens match', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(result.tokenId).toBe('token-1');
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });
  });
});