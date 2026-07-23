import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Registers global authentication + authorization guards.
 * Registration order = execution order: authenticate first (JwtAccessGuard),
 * then authorize (PermissionsGuard). Both honor the @Public() decorator; the
 * permission check additionally honors @SkipPermissions().
 */
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthzModule {}
