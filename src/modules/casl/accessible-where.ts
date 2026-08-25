import { accessibleBy } from '@casl/prisma';
import { AppAbility } from './casl-ability.factory';

/**
 * `accessibleBy(ability, action)` returns a Proxy whose property-access key
 * is passed straight through as the CASL subject type — it has no built-in
 * dependency on Prisma model names, so our existing kebab-case subject
 * strings (`'time-logs'`, matching `Permission.subject` and
 * `@RequirePermissions`) work directly. This wraps that bracket-notation
 * access with the caller's target Prisma `WhereInput` type, since
 * `accessibleBy`'s own types assume `Prisma.ModelName` keys.
 */
export function accessibleWhere<T>(
  ability: AppAbility,
  action: string,
  subject: string,
): T {
  return (accessibleBy(ability, action) as unknown as Record<string, T>)[
    subject
  ];
}
