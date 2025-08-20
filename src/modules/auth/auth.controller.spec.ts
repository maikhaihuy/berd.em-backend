import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { User, UserStatus } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let refreshTokenService: RefreshTokenService;
  let testUser: User;

  // Mock guards
  const mockLocalAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockJwtAccessGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockJwtRefreshGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            createRefreshToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
            getUserActiveTokens: jest.fn(),
            rotateRefreshToken: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(LocalAuthGuard)
      .useValue(mockLocalAuthGuard)
      .overrideGuard(JwtAccessGuard)
      .useValue(mockJwtAccessGuard)
      .overrideGuard(JwtRefreshGuard)
      .useValue(mockJwtRefreshGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);

    // Mock test user
    testUser = {
      id: 1,
      username: 'testuser',
      password: 'hashedpassword',
      employeeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: UserStatus.ACTIVE,
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockLoginResult = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: {
          id: testUser.id,
          username: testUser.username,
          employeeId: testUser.employeeId,
        },
      };

      const mockRequest = {
        user: testUser,
      };

      (authService.login as jest.Mock).mockResolvedValue(mockLoginResult);

      const result = await controller.login(mockRequest as any);

      expect(result).toEqual(mockLoginResult);
      expect(authService.login).toHaveBeenCalledWith(testUser);
    });

    it('should handle login with missing user in request', async () => {
      const mockRequest = {
        user: undefined,
      };

      const mockLoginResult = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: {
          id: testUser.id,
          username: testUser.username,
          employeeId: testUser.employeeId,
        },
      };

      (authService.login as jest.Mock).mockResolvedValue(mockLoginResult);

      const result = await controller.login(mockRequest as any);

      expect(result).toEqual(mockLoginResult);
      expect(authService.login).toHaveBeenCalledWith(undefined);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockRefreshResult = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: {
          id: testUser.id,
          username: testUser.username,
          employeeId: testUser.employeeId,
        },
      };

      const mockRequest = {
        user: {
          userId: testUser.id,
          refreshToken: 'old-refresh-token',
        },
      };

      (authService.refreshTokens as jest.Mock).mockResolvedValue(
        mockRefreshResult,
      );

      const result = await controller.refresh(mockRequest as any);

      expect(result).toEqual(mockRefreshResult);
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'old-refresh-token',
        testUser.id,
      );
    });

    it('should handle refresh with missing user data', async () => {
      const mockRequest = {
        user: {
          userId: undefined,
          refreshToken: undefined,
        },
      };

      const mockRefreshResult = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: {
          id: testUser.id,
          username: testUser.username,
          employeeId: testUser.employeeId,
        },
      };

      (authService.refreshTokens as jest.Mock).mockResolvedValue(
        mockRefreshResult,
      );

      const result = await controller.refresh(mockRequest as any);

      expect(result).toEqual(mockRefreshResult);
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
          refreshToken: 'refresh-token-to-revoke',
        },
      };

      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authService.logout).toHaveBeenCalledWith(
        'refresh-token-to-revoke',
        testUser.id,
      );
    });

    it('should handle logout with missing user data', async () => {
      const mockRequest = {
        user: {
          userId: undefined,
          refreshToken: undefined,
        },
      };

      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authService.logout).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('logoutDevice', () => {
    it('should logout from specific device successfully', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
          refreshToken: 'device-refresh-token',
        },
      };

      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.logoutDevice(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authService.logout).toHaveBeenCalledWith(
        'device-refresh-token',
        testUser.id,
      );
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices successfully', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
        },
      };

      (refreshTokenService.revokeAllUserTokens as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.logoutAll(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out from all devices' });
      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        testUser.id,
      );
    });

    it('should handle logout all with missing user data', async () => {
      const mockRequest = {
        user: {
          userId: undefined,
        },
      };

      (refreshTokenService.revokeAllUserTokens as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.logoutAll(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out from all devices' });
      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions successfully', async () => {
      const mockActiveSessions = [
        {
          id: 'session-1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          expiresAt: new Date('2024-01-08T10:00:00Z'),
        },
        {
          id: 'session-2',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          expiresAt: new Date('2024-01-09T10:00:00Z'),
        },
      ];

      const mockRequest = {
        user: {
          userId: testUser.id,
        },
      };

      (refreshTokenService.getUserActiveTokens as jest.Mock).mockResolvedValue(
        mockActiveSessions,
      );

      const result = await controller.getActiveSessions(mockRequest as any);

      expect(result).toEqual({
        activeSessions: mockActiveSessions,
      });
      expect(refreshTokenService.getUserActiveTokens).toHaveBeenCalledWith(
        testUser.id,
      );
    });

    it('should return empty sessions when user has no active sessions', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
        },
      };

      (refreshTokenService.getUserActiveTokens as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await controller.getActiveSessions(mockRequest as any);

      expect(result).toEqual({
        activeSessions: [],
      });
    });

    it('should handle missing user data', async () => {
      const mockRequest = {
        user: {
          userId: undefined,
        },
      };

      (refreshTokenService.getUserActiveTokens as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await controller.getActiveSessions(mockRequest as any);

      expect(result).toEqual({
        activeSessions: [],
      });
      expect(refreshTokenService.getUserActiveTokens).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe('guard integration', () => {
    it('should use LocalAuthGuard for login endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.login);
      expect(guards).toBeDefined();
      expect(guards).toContain(LocalAuthGuard);
    });

    it('should use JwtRefreshGuard for refreshToken endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.refreshToken);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtRefreshGuard);
    });

    it('should use JwtAccessGuard for logout endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.logout);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAccessGuard);
    });

    it('should use JwtRefreshGuard for logoutDevice endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.logoutDevice);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtRefreshGuard);
    });

    it('should use JwtAccessGuard for logoutAll endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.logoutAll);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAccessGuard);
    });

    it('should use JwtAccessGuard for getActiveSessions endpoint', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        controller.getActiveSessions,
      );
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAccessGuard);
    });
  });

  describe('error handling', () => {
    it('should handle service errors in login', async () => {
      const mockRequest = {
        user: testUser,
      };

      const error = new Error('Login service error');
      (authService.login as jest.Mock).mockRejectedValue(error);

      await expect(controller.login(mockRequest as any)).rejects.toThrow(
        'Login service error',
      );
    });

    it('should handle service errors in refresh', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
          refreshToken: 'refresh-token',
        },
      };

      const error = new Error('Refresh service error');
      (authService.refreshToken as jest.Mock).mockRejectedValue(error);

      await expect(controller.refreshToken(mockRequest as any)).rejects.toThrow(
        'Refresh service error',
      );
    });

    it('should handle service errors in logout', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
          refreshToken: 'refresh-token',
        },
      };

      const error = new Error('Logout service error');
      (authService.logout as jest.Mock).mockRejectedValue(error);

      await expect(controller.logout(mockRequest as any)).rejects.toThrow(
        'Logout service error',
      );
    });

    it('should handle service errors in logoutAll', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
        },
      };

      const error = new Error('Logout all service error');
      (refreshTokenService.revokeAllUserTokens as jest.Mock).mockRejectedValue(
        error,
      );

      await expect(controller.logoutAll(mockRequest as any)).rejects.toThrow(
        'Logout all service error',
      );
    });

    it('should handle service errors in getActiveSessions', async () => {
      const mockRequest = {
        user: {
          userId: testUser.id,
        },
      };

      const error = new Error('Get sessions service error');
      (refreshTokenService.getUserActiveTokens as jest.Mock).mockRejectedValue(
        error,
      );

      await expect(
        controller.getActiveSessions(mockRequest as any),
      ).rejects.toThrow('Get sessions service error');
    });
  });
});
