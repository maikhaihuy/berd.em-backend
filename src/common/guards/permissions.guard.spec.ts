import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard, RequestWithUser } from './permissions.guard';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { SKIP_PERMISSIONS } from '../decorators/skip-permissions.decorator';
import { REQUIRE_PERMISSIONS } from '../decorators/permissions.decorator';
import { JsonObject } from './permission-condition.helper';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleBy } from '@casl/prisma';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let lastRequest: RequestWithUser;

  /**
   * Builds a mock Reflector whose getAllAndOverride returns the given values
   * keyed by metadata key, plus an ExecutionContext exposing request.user.
   * Uses the real CaslAbilityFactory (it has no dependencies of its own) so
   * these tests exercise the guard's actual CASL integration, not a mock of
   * it.
   */
  const setup = (
    metadata: {
      isPublic?: boolean;
      skip?: boolean;
      required?: { action: string; subject: string }[];
    },
    user?: {
      employeeId?: number;
      userId?: number;
      permissions?: {
        action: string;
        subject: string;
        condition?: JsonObject | null;
      }[];
    },
  ) => {
    reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC) return metadata.isPublic;
        if (key === SKIP_PERMISSIONS) return metadata.skip;
        if (key === REQUIRE_PERMISSIONS) return metadata.required;
        return undefined;
      }),
    } as unknown as Reflector;

    guard = new PermissionsGuard(reflector, new CaslAbilityFactory());

    lastRequest = { user } as unknown as RequestWithUser;

    const context = {
      switchToHttp: () => ({ getRequest: () => lastRequest }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return context;
  };

  const whereFor = (action: string, subject: string): unknown =>
    (accessibleBy(lastRequest.ability!, action) as Record<string, unknown>)[
      subject
    ];

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

  describe('CASL ability construction and attachment', () => {
    it('allows a conditioned grant to satisfy the route-level check and attaches a resolved-condition ability', () => {
      const context = setup(
        { required: [{ action: 'read', subject: 'time-logs' }] },
        {
          employeeId: 42,
          permissions: [
            {
              action: 'read',
              subject: 'time-logs',
              condition: { employeeId: '$self' },
            },
          ],
        },
      );

      expect(guard.canActivate(context)).toBe(true);
      expect(lastRequest.ability).toBeDefined();
      expect(whereFor('read', 'time-logs')).toEqual({
        OR: [{ employeeId: 42 }],
      });
    });

    it('resolves a nested condition through a relation path', () => {
      const context = setup(
        { required: [{ action: 'read', subject: 'attendance-history' }] },
        {
          employeeId: 42,
          permissions: [
            {
              action: 'read',
              subject: 'attendance-history',
              condition: { assignment: { is: { employeeId: '$self' } } },
            },
          ],
        },
      );

      expect(guard.canActivate(context)).toBe(true);
      expect(whereFor('read', 'attendance-history')).toEqual({
        OR: [{ assignment: { is: { employeeId: 42 } } }],
      });
    });

    it('is authorized at the route level regardless of whether the matching grant is conditioned', () => {
      const context = setup(
        { required: [{ action: 'read', subject: 'time-logs' }] },
        {
          employeeId: 42,
          permissions: [
            {
              action: 'read',
              subject: 'time-logs',
              condition: { employeeId: '$self' },
            },
          ],
        },
      );

      // Route-level `can()` is a type check, not a row check — it passes
      // even though the grant is conditioned. Row-level scoping is applied
      // separately via accessibleBy at the service layer.
      expect(guard.canActivate(context)).toBe(true);
    });

    it('an unconditioned grant produces an unrestricted accessibleBy filter', () => {
      const context = setup(
        { required: [{ action: 'read', subject: 'time-logs' }] },
        {
          employeeId: 42,
          permissions: [{ action: 'read', subject: 'time-logs' }],
        },
      );

      expect(guard.canActivate(context)).toBe(true);
      expect(whereFor('read', 'time-logs')).toEqual({});
    });

    it('denies with 403 when `$self` cannot be resolved for the caller', () => {
      const context = setup(
        { required: [{ action: 'read', subject: 'time-logs' }] },
        {
          employeeId: undefined,
          permissions: [
            {
              action: 'read',
              subject: 'time-logs',
              condition: { employeeId: '$self' },
            },
          ],
        },
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
