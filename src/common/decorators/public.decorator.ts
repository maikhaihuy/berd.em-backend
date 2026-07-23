import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'is_public';

/**
 * Marks a route as public: it skips both authentication (JwtAccessGuard)
 * and authorization (PermissionsGuard). Use for login, refresh, health, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
