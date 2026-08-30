import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC } from '@common/decorators/public.decorator';
import { ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED } from '@common/decorators/allow-while-password-change-required.decorator';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';

export interface RequestWithAuthenticatedUser extends Request {
  user?: AuthenticatedUserDto;
}

/**
 * Restricts a User flagged `mustChangePassword` to a small allowlist of
 * routes (see design.md - Decision 4) until they call
 * POST /auth/change-password. Runs after JwtAccessGuard and before
 * PermissionsGuard in `authz.module.ts`, so a flagged user is rejected
 * before any permission-resolution work happens.
 */
@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuthenticatedUser>();
    const user = request.user;
    if (!user) {
      return true;
    }

    if (!user.mustChangePassword) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    // `details` (not a top-level `code`) is what GlobalExceptionFilter
    // actually forwards from an HttpException body — see
    // src/common/filters/global-exception.filter.ts.
    throw new ForbiddenException({
      message: 'Password change required before continuing',
      details: { code: 'PASSWORD_CHANGE_REQUIRED' },
    });
  }
}
