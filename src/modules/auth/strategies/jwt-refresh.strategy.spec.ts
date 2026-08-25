import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { PrismaService } from '@modules/prisma/prisma.service';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import { RefreshTokenPayloadDto } from '../dto/refresh-token-payload.dto';
import { InvalidTokenException } from '../exceptions/auth.exceptions';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockedCompare = bcrypt.compare as unknown as jest.Mock;

const firstCallArg = (mock: jest.Mock): unknown =>
  (mock.mock.calls[0] as unknown[])[0];

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;
  let prismaService: {
    user: { findUnique: jest.Mock };
    refreshToken: { deleteMany: jest.Mock };
  };

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const mockUser = {
    id: 1,
    phoneNumber: '0900000001',
    status: UserStatus.ACTIVE,
    userRoles: [{ role: { name: 'Employee' } }],
    refreshTokens: [
      { id: 'token-1', hashedToken: 'hashed-token-1', expiresAt: future },
      { id: 'token-2', hashedToken: 'hashed-token-2', expiresAt: future },
    ],
  };

  const mockRequest = {
    body: { refreshToken: 'test-refresh-token' },
  } as unknown as Request;

  const mockPayload: RefreshTokenPayloadDto = {
    sub: 1,
    phone: '0900000001',
    roles: ['Employee'],
    branches: [],
    managedBranches: [],
  };

  beforeEach(async () => {
    prismaService = {
      user: { findUnique: jest.fn() },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
            get: jest.fn().mockReturnValue('test-refresh-secret'),
          },
        },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should call done with the session when the token matches the first record', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedCompare.mockResolvedValueOnce(true);
      const done = jest.fn();

      await strategy.validate(mockRequest, mockPayload, done);

      expect(done).toHaveBeenCalledTimes(1);
      const [err, session] = done.mock.calls[0] as [
        Error | null,
        RefreshSessionDto,
      ];
      expect(err).toBeNull();
      expect(session).toBeInstanceOf(RefreshSessionDto);
      expect(session.userId).toBe(mockUser.id);
      expect(session.phone).toBe(mockUser.phoneNumber);
      expect(session.roles).toEqual(['Employee']);
      expect(session.tokenId).toBe('token-1');
      expect(mockedCompare).toHaveBeenCalledWith(
        'test-refresh-token',
        'hashed-token-1',
      );
    });

    it('should call done with the session when the token matches the second record', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedCompare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const done = jest.fn();

      await strategy.validate(mockRequest, mockPayload, done);

      const [, session] = done.mock.calls[0] as [
        Error | null,
        RefreshSessionDto,
      ];
      expect(session.tokenId).toBe('token-2');
      expect(mockedCompare).toHaveBeenCalledTimes(2);
    });

    it('should call done with UnauthorizedException when the refresh token is missing', async () => {
      const done = jest.fn();

      await strategy.validate(
        { body: {} } as unknown as Request,
        mockPayload,
        done,
      );

      expect(done).toHaveBeenCalledTimes(1);
      expect(firstCallArg(done)).toBeInstanceOf(UnauthorizedException);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should call done with UnauthorizedException when the user is not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const done = jest.fn();

      await strategy.validate(mockRequest, mockPayload, done);

      expect(firstCallArg(done)).toBeInstanceOf(UnauthorizedException);
    });

    it('should call done with InvalidTokenException when no refresh token matches', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedCompare.mockResolvedValue(false);
      const done = jest.fn();

      await strategy.validate(mockRequest, mockPayload, done);

      expect(firstCallArg(done)).toBeInstanceOf(InvalidTokenException);
      expect(mockedCompare).toHaveBeenCalledTimes(2);
    });

    it('should call done with InvalidTokenException when the user has no refresh tokens', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        refreshTokens: [],
      });
      const done = jest.fn();

      await strategy.validate(mockRequest, mockPayload, done);

      expect(firstCallArg(done)).toBeInstanceOf(InvalidTokenException);
      expect(mockedCompare).not.toHaveBeenCalled();
    });
  });
});
