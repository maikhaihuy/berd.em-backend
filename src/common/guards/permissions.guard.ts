import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { SKIP_PERMISSIONS } from '../decorators/skip-permissions.decorator';
import {
  REQUIRE_PERMISSIONS,
  RequiredPermission,
} from '../decorators/permissions.decorator';
import {
  CaslAbilityFactory,
  AppAbility,
  CaslUser,
} from '@modules/casl/casl-ability.factory';

export interface RequestWithUser extends Request {
  user?: CaslUser;
  ability?: AppAbility;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Public routes bypass authorization entirely.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Authenticated-only routes: skip the permission check.
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(
      REQUIRE_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );

    // Deny-by-default: a protected route must declare its required permissions.
    if (!required || required.length === 0) {
      throw new ForbiddenException(
        'This route does not declare required permissions',
      );
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    // Type-level check: is the subject string, not a fetched instance, so a
    // rule satisfies this regardless of whether it carries a condition —
    // narrowing to specific rows is the handler/service's job via
    // `accessibleBy(ability, action)[subject]`.
    const hasAll = required.every((rule) =>
      ability.can(rule.action, rule.subject),
    );

    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.ability = ability;

    return true;
  }
}
