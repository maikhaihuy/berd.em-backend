import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { SKIP_PERMISSIONS } from '../decorators/skip-permissions.decorator';
import { REQUIRE_PERMISSIONS } from '../decorators/permissions.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  /**
   * Builds a mock Reflector whose getAllAndOverride returns the given values
   * keyed by metadata key, plus an ExecutionContext exposing request.user.
   */
  const setup = (
    metadata: {
      isPublic?: boolean;
      skip?: boolean;
      required?: { action: string; subject: string }[];
    },
    user?: { permissions?: { action: string; subject: string }[] },
  ) => {
    reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC) return metadata.isPublic;
        if (key === SKIP_PERMISSIONS) return metadata.skip;
        if (key === REQUIRE_PERMISSIONS) return metadata.required;
        return undefined;
      }),
    } as unknown as Reflector;

    guard = new PermissionsGuard(reflector);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return context;
  };

  it('allows public routes without a user', () => {
    const context = setup({ isPublic: true }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows @SkipPermissions routes for any authenticated user', () => {
    const context = setup({ skip: true }, { permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws when there is no authenticated user', () => {
    const context = setup(
      { required: [{ action: 'read', subject: 'users' }] },
      undefined,
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('denies by default when a protected route declares no permissions', () => {
    const context = setup({}, { permissions: [] });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows when the user holds the exact required permission', () => {
    const context = setup(
      { required: [{ action: 'read', subject: 'users' }] },
      { permissions: [{ action: 'read', subject: 'users' }] },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies when the user lacks the required permission', () => {
    const context = setup(
      { required: [{ action: 'delete', subject: 'users' }] },
      { permissions: [{ action: 'read', subject: 'users' }] },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('treats action "manage" as a wildcard over actions', () => {
    const context = setup(
      { required: [{ action: 'delete', subject: 'users' }] },
      { permissions: [{ action: 'manage', subject: 'users' }] },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('treats subject "all" as a wildcard over subjects', () => {
    const context = setup(
      { required: [{ action: 'delete', subject: 'users' }] },
      { permissions: [{ action: 'manage', subject: 'all' }] },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('requires every rule to be satisfied (AND semantics)', () => {
    const context = setup(
      {
        required: [
          { action: 'read', subject: 'users' },
          { action: 'update', subject: 'roles' },
        ],
      },
      { permissions: [{ action: 'read', subject: 'users' }] },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
