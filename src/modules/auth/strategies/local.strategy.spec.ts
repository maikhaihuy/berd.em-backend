import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LocalStrategy } from './local.strategy';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 1,
    username: 'testuser',
    password: 'hashedPassword',
    employeeId: null,
    status: 'ACTIVE',
    roles: [{ name: 'employee' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return authenticated user when credentials are valid', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'plainPassword';

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      // Act
      const result = await strategy.validate(username, password);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
        include: {
          roles: true,
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toBeInstanceOf(AuthenticatedUserDto);
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      const username = 'nonexistentuser';
      const password = 'plainPassword';

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(username, password)).rejects.toThrow(
        new NotFoundException(`User with username ${username} not found.`),
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
        include: {
          roles: true,
        },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'wrongPassword';

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(strategy.validate(username, password)).rejects.toThrow(
        new UnauthorizedException('Username or password are not match.'),
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
        include: {
          roles: true,
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    });

    it('should handle bcrypt comparison error', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'plainPassword';
      const bcryptError = new Error('Bcrypt error');

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockRejectedValue(bcryptError);

      // Act & Assert
      await expect(strategy.validate(username, password)).rejects.toThrow(
        bcryptError,
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
        include: {
          roles: true,
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    });

    it('should handle database error', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'plainPassword';
      const dbError = new Error('Database connection error');

      (prismaService.user.findUnique as jest.Mock).mockRejectedValue(dbError);

      // Act & Assert
      await expect(strategy.validate(username, password)).rejects.toThrow(
        dbError,
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
        include: {
          roles: true,
        },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });
});
