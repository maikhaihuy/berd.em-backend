import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { CaslModule } from '@modules/casl/casl.module';

/**
 * Registers global rate-limiting, authentication, and authorization guards.
 * Registration order = execution order: rate-limit first (ThrottlerGuard,
 * cheapest check, caps brute-force attempts before spending cycles on auth),
 * then authenticate (JwtAccessGuard), then authorize (PermissionsGuard,
 * which builds a CASL Ability via CaslAbilityFactory). JwtAccessGuard and
 * PermissionsGuard both honor the @Public() decorator; the permission check
 * additionally honors @SkipPermissions(). Route-level @Throttle(...)
 * decorators override this module's default limit per-route.
 */
@Module({
  imports: [CaslModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthzModule {}
