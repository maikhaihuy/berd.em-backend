import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PasswordService } from '../../../common/services/password.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';
import { UserStatus } from '@prisma/client';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let prismaService: { user: { findUnique: jest.Mock } };
  let passwordService: { compare: jest.Mock };

  const phoneNumber = '0900000001';
  const password = 'plainPassword';

  const mockUser = {
    id: 1,
    phoneNumber,
    password: 'hashedPassword',
    status: UserStatus.ACTIVE,
    role: { name: 'Employee' },
  };

  beforeEach(async () => {
    prismaService = { user: { findUnique: jest.fn() } };
    passwordService = { compare: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: PrismaService, useValue: prismaService },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return authenticated user when credentials are valid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordService.compare.mockResolvedValue(true);

      const result = await strategy.validate(phoneNumber, password);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phoneNumber } }),
      );
      expect(passwordService.compare).toHaveBeenCalledWith(
        password,
        mockUser.password,
      );
      expect(result).toBeInstanceOf(AuthenticatedUserDto);
      expect(result.userId).toBe(mockUser.id);
      expect(result.phone).toBe(mockUser.phoneNumber);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(phoneNumber, password)).rejects.toThrow(
        NotFoundException,
      );
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is not active', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.INACTIVE,
      });

      await expect(strategy.validate(phoneNumber, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user has no password (3rd party login)', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: null,
      });

      await expect(strategy.validate(phoneNumber, password)).rejects.toThrow(
        NotFoundException,
      );
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordService.compare.mockResolvedValue(false);

      await expect(strategy.validate(phoneNumber, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(passwordService.compare).toHaveBeenCalledWith(
        password,
        mockUser.password,
      );
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection error');
      prismaService.user.findUnique.mockRejectedValue(dbError);

      await expect(strategy.validate(phoneNumber, password)).rejects.toThrow(
        dbError,
      );
      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should authenticate normally for a User with no mustChangePassword expiry set', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        mustChangePassword: false,
        mustChangePasswordExpiresAt: null,
      });
      passwordService.compare.mockResolvedValue(true);

      const result = await strategy.validate(phoneNumber, password);

      expect(result).toBeInstanceOf(AuthenticatedUserDto);
    });

    it('should authenticate with a correct, not-yet-expired one-time credential', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        mustChangePassword: true,
        mustChangePasswordExpiresAt: new Date(Date.now() + 60_000),
      });
      passwordService.compare.mockResolvedValue(true);

      const result = await strategy.validate(phoneNumber, password);

      expect(result).toBeInstanceOf(AuthenticatedUserDto);
    });

    it('should reject login with a distinct error once the one-time credential has expired', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        mustChangePassword: true,
        mustChangePasswordExpiresAt: new Date(Date.now() - 60_000),
      });
      passwordService.compare.mockResolvedValue(true);

      await expect(strategy.validate(phoneNumber, password)).rejects.toThrow(
        UnauthorizedException,
      );
      try {
        await strategy.validate(phoneNumber, password);
        fail('expected validate() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        const response = (error as UnauthorizedException).getResponse() as {
          details?: { code?: string };
        };
        expect(response.details?.code).toBe('INITIAL_PASSWORD_EXPIRED');
      }
    });
  });
});
