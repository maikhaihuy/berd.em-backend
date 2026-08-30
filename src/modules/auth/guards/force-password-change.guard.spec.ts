import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ForcePasswordChangeGuard,
  RequestWithAuthenticatedUser,
} from './force-password-change.guard';
import { IS_PUBLIC } from '@common/decorators/public.decorator';
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED } from '@common/decorators/allow-while-password-change-required.decorator';

describe('ForcePasswordChangeGuard', () => {
  let guard: ForcePasswordChangeGuard;
  let lastRequest: RequestWithAuthenticatedUser;

  const setup = (
    metadata: { isPublic?: boolean; allowed?: boolean },
    user?: { mustChangePassword: boolean },
  ) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC) return metadata.isPublic;
        if (key === ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED)
          return metadata.allowed;
        return undefined;
      }),
    } as unknown as Reflector;

    guard = new ForcePasswordChangeGuard(reflector);
    lastRequest = { user } as unknown as RequestWithAuthenticatedUser;

    return {
      switchToHttp: () => ({ getRequest: () => lastRequest }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('allows a @Public() route regardless of the user', () => {
    const context = setup({ isPublic: true }, { mustChangePassword: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a request with no authenticated user', () => {
    const context = setup({}, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user who is not flagged mustChangePassword', () => {
    const context = setup({}, { mustChangePassword: false });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a flagged user on an @AllowWhilePasswordChangeRequired() route', () => {
    const context = setup({ allowed: true }, { mustChangePassword: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks a flagged user on a non-exempt route with a distinct error code', () => {
    const context = setup({}, { mustChangePassword: true });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
      fail('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({
          details: { code: 'PASSWORD_CHANGE_REQUIRED' },
        }),
      );
    }
  });
});
