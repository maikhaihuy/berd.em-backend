import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';
import { AccessTokenPayloadDto } from '../dto/access-token-payload.dto';

describe('JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 1,
    username: 'testuser',
    password: 'hashedPassword',
    employeeId: 123,
    status: 'ACTIVE',
    roles: [
      {
        id: 1,
        name: 'employee',
        permissions: [
          { id: 1, action: 'read', subject: 'own' },
          { id: 2, action: 'update', subject: 'own' },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayload: AccessTokenPayloadDto = {
    sub: 1,
    email: 'test@example.com',
    roles: ['employee'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAccessStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtAccessStrategy>(JwtAccessStrategy);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);

    // Setup default config mock
    configService.get.mockReturnValue('test-jwt-secret');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return authenticated user when token payload is valid', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });
      expect(result).toBeInstanceOf(AuthenticatedUserDto);
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
      expect(result.employeeId).toBe(mockUser.employeeId);
      expect(result.roles).toEqual(['employee']);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });
    });

    it('should handle user with multiple roles', async () => {
      // Arrange
      const userWithMultipleRoles = {
        ...mockUser,
        roles: [
          {
            id: 1,
            name: 'employee',
            permissions: [{ id: 1, action: 'read', subject: 'own' }],
          },
          {
            id: 2,
            name: 'manager',
            permissions: [{ id: 2, action: 'manage', subject: 'all' }],
          },
        ],
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithMultipleRoles,
      );

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result.roles).toEqual(['employee', 'manager']);
    });

    it('should handle user with no roles', async () => {
      // Arrange
      const userWithNoRoles = {
        ...mockUser,
        roles: [],
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithNoRoles,
      );

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result.roles).toEqual([]);
    });

    it('should handle database error', async () => {
      // Arrange
      const dbError = new Error('Database connection error');
      (prismaService.user.findUnique as jest.Mock).mockRejectedValue(dbError);

      // Act & Assert
      await expect(strategy.validate(mockPayload)).rejects.toThrow(dbError);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });
    });

    it('should handle payload with different user ID', async () => {
      // Arrange
      const differentPayload: AccessTokenPayloadDto = {
        ...mockPayload,
        sub: 999,
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(differentPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });
    });
  });
});
