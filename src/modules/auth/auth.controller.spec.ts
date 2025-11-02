import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { User, UserStatus } from '@prisma/client';
import { TokenDto } from './dto/token.dto';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';

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
      const mockLoginResult: TokenDto = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      const mockRequest = {
        user: testUser,
      };

      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue(mockLoginResult);

      const result = await controller.login(
        {} as LoginDto,
        mockRequest.user as unknown as AuthenticatedUserDto,
      );

      expect(result).toEqual(mockLoginResult);
      expect(loginSpy).toHaveBeenCalledWith(testUser);
    });

    it('should handle login with missing user in request', async () => {
      const mockRequest = {
        user: undefined,
      };

      const mockLoginResult: TokenDto = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue(mockLoginResult);

      const result = await controller.login(
        {} as LoginDto,
        mockRequest.user as unknown as AuthenticatedUserDto,
      );

      expect(result).toEqual(mockLoginResult);
      expect(loginSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockRefreshResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      const mockRequest = {
        user: {
          ...testUser,
          roles: [],
          tokenId: 'token-id-123',
          refreshToken: 'old-refresh-token',
        },
      };

      const refreshTokenSpy = jest
        .spyOn(authService, 'refreshToken')
        .mockResolvedValue(mockRefreshResult);

      const result = await controller.refreshToken(
        mockRequest.user as RefreshSessionDto,
      );

      expect(result).toEqual(mockRefreshResult);
      expect(refreshTokenSpy).toHaveBeenCalledWith(mockRequest.user);
    });

    it('should handle refresh with missing user data', async () => {
      const mockRequest = {
        user: {
          ...testUser,
          roles: [],
          tokenId: 'token-id-123',
          refreshToken: undefined,
        },
      };

      const mockRefreshResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      const refreshTokenSpy = jest
        .spyOn(authService, 'refreshToken')
        .mockResolvedValue(mockRefreshResult);

      const result = await controller.refreshToken(
        mockRequest.user as RefreshSessionDto,
      );

      expect(result).toEqual(mockRefreshResult);
      expect(refreshTokenSpy).toHaveBeenCalledWith(mockRequest.user);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const mockRequest = {
        user: {
          ...testUser,
          roles: [],
          tokenId: 'token-id-123',
        },
      };

      const logoutSpy = jest
        .spyOn(authService, 'logout')
        .mockResolvedValue(undefined);

      const result = await controller.logout(
        mockRequest.user as RefreshSessionDto,
      );

      expect(result).toEqual({ message: 'Logout successful' });
      expect(logoutSpy).toHaveBeenCalledWith(
        'refresh-token',
        mockRequest.user.id,
      );
    });

    it('should handle logout with missing user data', async () => {
      const mockRequest = {
        user: {
          ...testUser,
          roles: [],
          tokenId: 'token-id-123',
        },
      };

      const logoutSpy = jest
        .spyOn(authService, 'logout')
        .mockResolvedValue(undefined);

      const result = await controller.logout(
        mockRequest.user as RefreshSessionDto,
      );

      expect(result).toEqual({ message: 'Logout successful' });
      expect(logoutSpy).toHaveBeenCalledWith(
        'refresh-token',
        mockRequest.user.id,
      );
    });
  });

  describe('logoutDevice', () => {
    it('should logout from specific device successfully', async () => {
      const mockRequest = {
        user: {
          ...testUser,
          roles: [],
          tokenId: 'device-refresh-token',
        },
      };

      const logoutSpy = jest
        .spyOn(authService, 'logout')
        .mockResolvedValue(undefined);

      const result = await controller.logoutDevice(
        mockRequest.user as RefreshSessionDto,
      );

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(logoutSpy).toHaveBeenCalledWith(
        'device-refresh-token',
        testUser.id,
      );
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices successfully', async () => {
      const mockRequest = {
        user: {
          id: testUser.id,
          username: testUser.username,
        },
      };

      const logoutAllSpy = jest
        .spyOn(refreshTokenService, 'revokeAllUserTokens')
        .mockResolvedValue(undefined);

      const result = await controller.logoutAll(
        mockRequest.user as AuthenticatedUserDto,
      );

      expect(result).toEqual({ message: 'Logged out from all devices' });
      expect(logoutAllSpy).toHaveBeenCalledWith(testUser.id);
    });

    it('should handle logout all with missing user data', async () => {
      const mockRequest = {
        user: {
          userId: undefined,
        },
      };

      const logoutAllSpy = jest
        .spyOn(refreshTokenService, 'revokeAllUserTokens')
        .mockResolvedValue(undefined);

      (refreshTokenService.revokeAllUserTokens as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.logoutAll(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out from all devices' });
      expect(logoutAllSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions successfully', async () => {
      const mockActiveSessions = [
        {
          id: 'session-1',
          userId: testUser.id,
          hashedToken: 'hashed-token-2',
          device: 'device-1',
          ipAddress: '127.0.0.1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          expiresAt: new Date('2024-01-08T10:00:00Z'),
        },
        {
          id: 'session-2',
          userId: testUser.id,
          hashedToken: 'hashed-token-2',
          device: 'device-2',
          ipAddress: '127.0.0.1',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          expiresAt: new Date('2024-01-09T10:00:00Z'),
        },
      ];

      const mockRequest = {
        user: {
          ...testUser,
          roles: [],
        },
      };

      const getActiveTokensSpy = jest
        .spyOn(refreshTokenService, 'getUserActiveTokens')
        .mockResolvedValue(mockActiveSessions);

      const result = await controller.getActiveSessions(
        mockRequest as unknown as AuthenticatedUserDto,
      );

      expect(result).toEqual({
        activeSessions: mockActiveSessions,
      });
      expect(getActiveTokensSpy).toHaveBeenCalledWith(testUser.id);
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

      const getActiveTokensSpy = jest
        .spyOn(refreshTokenService, 'getUserActiveTokens')
        .mockResolvedValue([]);

      const result = await controller.getActiveSessions(mockRequest as any);

      expect(result).toEqual({
        activeSessions: [],
      });
      expect(getActiveTokensSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('guard integration', () => {
    it('should use LocalAuthGuard for login endpoint', () => {
      const loginMethod = controller.login;
      const guards = Reflect.getMetadata(
        '__guards__',
        loginMethod,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(LocalAuthGuard);
    });

    it('should use JwtRefreshGuard for refreshToken endpoint', () => {
      const refreshTokenMethod = controller.refreshToken;
      const guards = Reflect.getMetadata(
        '__guards__',
        refreshTokenMethod,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtRefreshGuard);
    });

    it('should use JwtAccessGuard for logout endpoint', () => {
      const logoutMethod = controller.logout;
      const guards = Reflect.getMetadata(
        '__guards__',
        logoutMethod,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAccessGuard);
    });

    it('should use JwtRefreshGuard for logoutDevice endpoint', () => {
      const logoutDeviceMethod = controller.logoutDevice;
      const guards = Reflect.getMetadata(
        '__guards__',
        logoutDeviceMethod,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtRefreshGuard);
    });

    it('should use JwtAccessGuard for logoutAll endpoint', () => {
      const logoutAllMethod = controller.logoutAll;
      const guards = Reflect.getMetadata(
        '__guards__',
        logoutAllMethod,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAccessGuard);
    });

    it('should use JwtAccessGuard for getActiveSessions endpoint', () => {
      const getActiveSessionsMethod = controller.getActiveSessions;
      const guards = Reflect.getMetadata(
        '__guards__',
        getActiveSessionsMethod,
      ) as unknown[];
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
      const loginSpy = jest.spyOn(authService, 'login');
      loginSpy.mockRejectedValue(error);

      await expect(
        controller.login({} as any, mockRequest.user as any),
      ).rejects.toThrow('Login service error');
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
