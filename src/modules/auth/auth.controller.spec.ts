/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { TokenDto } from './dto/token.dto';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let refreshTokenService: RefreshTokenService;

  const authUser = new AuthenticatedUserDto({
    userId: 1,
    phone: '0900000001',
    roles: ['Employee'],
    branches: [],
    managedBranches: [],
    permissions: [],
  });

  const refreshSession = new RefreshSessionDto({
    userId: 1,
    phone: '0900000001',
    roles: ['Employee'],
    branches: [],
    managedBranches: [],
    permissions: [],
    tokenId: 'token-id-123',
  });

  const mockLocalAuthGuard = { canActivate: jest.fn(() => true) };
  const mockJwtRefreshGuard = { canActivate: jest.fn(() => true) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            loginWithZalo: jest.fn(),
            loginWithDev: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            revokeAllUserTokens: jest.fn(),
            getUserActiveTokens: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(LocalAuthGuard)
      .useValue(mockLocalAuthGuard)
      .overrideGuard(JwtRefreshGuard)
      .useValue(mockJwtRefreshGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should log in the user resolved by LocalAuthGuard', async () => {
      const tokens: TokenDto = {
        accessToken: 'access',
        refreshToken: 'refresh',
      };
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue(tokens);

      const result = await controller.login({} as LoginDto, authUser);

      expect(result).toEqual(tokens);
      expect(loginSpy).toHaveBeenCalledWith(authUser);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens for the current session', async () => {
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      const refreshSpy = jest
        .spyOn(authService, 'refreshToken')
        .mockResolvedValue(tokens);

      const result = await controller.refreshToken(refreshSession);

      expect(result).toEqual(tokens);
      expect(refreshSpy).toHaveBeenCalledWith(refreshSession);
    });
  });

  describe('logout', () => {
    it('should revoke the current token and return a message', async () => {
      const logoutSpy = jest
        .spyOn(authService, 'logout')
        .mockResolvedValue(undefined);

      const result = await controller.logout(refreshSession);

      expect(result).toEqual({ message: 'Logout successful' });
      expect(logoutSpy).toHaveBeenCalledWith(refreshSession.tokenId);
    });
  });

  describe('logoutDevice', () => {
    it('should revoke the current device token', async () => {
      const logoutSpy = jest
        .spyOn(authService, 'logout')
        .mockResolvedValue(undefined);

      const result = await controller.logoutDevice(refreshSession);

      expect(result).toEqual({ message: 'Device logout successful' });
      expect(logoutSpy).toHaveBeenCalledWith(refreshSession.tokenId);
    });
  });

  describe('logoutAll', () => {
    it('should revoke all tokens for the user', async () => {
      const revokeSpy = jest
        .spyOn(refreshTokenService, 'revokeAllUserTokens')
        .mockResolvedValue(undefined);

      const result = await controller.logoutAll(authUser);

      expect(result).toEqual({ message: 'Logged out from all devices' });
      expect(revokeSpy).toHaveBeenCalledWith(authUser.userId);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions mapped to id/createdAt/expiresAt', async () => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const expiresAt = new Date('2024-01-08T10:00:00Z');
      jest.spyOn(refreshTokenService, 'getUserActiveTokens').mockResolvedValue([
        {
          id: 'session-1',
          userId: authUser.userId,
          source: null,
          device: 'device-1',
          ipAddress: '127.0.0.1',
          hashedToken: 'hash-1',
          createdAt,
          expiresAt,
        },
      ]);

      const result = await controller.getActiveSessions(authUser);

      expect(result).toEqual({
        activeSessions: [{ id: 'session-1', createdAt, expiresAt }],
      });
      expect(refreshTokenService.getUserActiveTokens).toHaveBeenCalledWith(
        authUser.userId,
      );
    });
  });

  describe('guard integration', () => {
    it('should protect login with LocalAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        controller.login,
      ) as unknown[];
      expect(guards).toContain(LocalAuthGuard);
    });

    it('should protect refreshToken with JwtRefreshGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        controller.refreshToken,
      ) as unknown[];
      expect(guards).toContain(JwtRefreshGuard);
    });

    it('should protect logoutDevice with JwtRefreshGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        controller.logoutDevice,
      ) as unknown[];
      expect(guards).toContain(JwtRefreshGuard);
    });
  });

  describe('error handling', () => {
    it('should propagate service errors from login', async () => {
      jest
        .spyOn(authService, 'login')
        .mockRejectedValue(new Error('Login service error'));

      await expect(controller.login({} as LoginDto, authUser)).rejects.toThrow(
        'Login service error',
      );
    });

    it('should propagate service errors from logoutAll', async () => {
      jest
        .spyOn(refreshTokenService, 'revokeAllUserTokens')
        .mockRejectedValue(new Error('Logout all service error'));

      await expect(controller.logoutAll(authUser)).rejects.toThrow(
        'Logout all service error',
      );
    });
  });
});
