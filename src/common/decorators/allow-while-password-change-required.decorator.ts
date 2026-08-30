import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED =
  'allow_while_password_change_required';

/**
 * Exempts a route from ForcePasswordChangeGuard: it stays reachable for a
 * User whose `mustChangePassword` flag is set. Use only for the small
 * allowlist a flagged User needs — changing their own password and
 * managing their own session (see design.md - Decision 4).
 */
export const AllowWhilePasswordChangeRequired = () =>
  SetMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED, true);
