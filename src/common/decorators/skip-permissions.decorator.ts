import { SetMetadata } from '@nestjs/common';

export const SKIP_PERMISSIONS = 'skip_permissions';

/**
 * Marks a route as authenticated-only: JwtAccessGuard still runs, but the
 * PermissionsGuard skips the (action, subject) check. Use for self-service
 * routes such as logout and active-sessions.
 */
export const SkipPermissions = () => SetMetadata(SKIP_PERMISSIONS, true);
