import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtTokenService } from './jwt-token.service';
import { PasswordService } from '../../common/services/password.service';
import { ZaloAuthService } from './zalo-auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaService } from '@modules/prisma/prisma.service';

/**
 * Wiring smoke test: instantiates the real auth providers with only the
 * external dependencies (Prisma, config secrets) mocked, to catch DI/config
 * regressions in the module graph.
 */
describe('AuthModule wiring', () => {
  let module: TestingModule;

  const configValues: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_ACCESS_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({})],
      providers: [
        AuthService,
        RefreshTokenService,
        JwtTokenService,
        PasswordService,
        ZaloAuthService,
        LocalStrategy,
        JwtAccessStrategy,
        JwtRefreshStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn(), findFirst: jest.fn() },
            refreshToken: {
              create: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            employee: { findUnique: jest.fn(), findFirst: jest.fn() },
            zaloIdentity: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
            getOrThrow: jest.fn((key: string) => {
              const value = configValues[key];
              if (value === undefined) {
                throw new Error(`Missing config: ${key}`);
              }
              return value;
            }),
          },
        },
      ],
    }).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it('should compile the module graph', () => {
    expect(module).toBeDefined();
  });

  it('should resolve AuthService', () => {
    expect(module.get(AuthService)).toBeInstanceOf(AuthService);
  });

  it('should resolve RefreshTokenService', () => {
    expect(module.get(RefreshTokenService)).toBeInstanceOf(RefreshTokenService);
  });

  it('should resolve JwtTokenService', () => {
    expect(module.get(JwtTokenService)).toBeInstanceOf(JwtTokenService);
  });

  it('should resolve the passport strategies', () => {
    expect(module.get(LocalStrategy)).toBeInstanceOf(LocalStrategy);
    expect(module.get(JwtAccessStrategy)).toBeInstanceOf(JwtAccessStrategy);
    expect(module.get(JwtRefreshStrategy)).toBeInstanceOf(JwtRefreshStrategy);
  });
});
