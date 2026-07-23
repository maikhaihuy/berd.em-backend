import { SetMetadata } from '@nestjs/common';

export interface RequiredPermission {
  action: string;
  subject: string;
}

export const REQUIRE_PERMISSIONS = 'require_permissions';

/**
 * Declares the (action, subject) permissions required to access a route.
 * Enforced by the global PermissionsGuard against the authenticated user's
 * role permissions. Multiple rules are ANDed together.
 */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS, permissions);
