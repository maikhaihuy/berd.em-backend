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

const MANAGE = 'manage';
const ALL = 'all';

interface UserPermission {
  action: string;
  subject: string;
}

interface RequestWithUser extends Request {
  user?: { permissions?: UserPermission[] };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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

    const granted = user.permissions ?? [];
    const hasAll = required.every((rule) =>
      granted.some(
        (p) =>
          (p.action === rule.action || p.action === MANAGE) &&
          (p.subject === rule.subject || p.subject === ALL),
      ),
    );

    if (!hasAll) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
