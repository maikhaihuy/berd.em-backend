import { ForbiddenException } from '@nestjs/common';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

const SELF_TOKEN = '$self';

export interface SelfIdentity {
  employeeId?: number;
  userId?: number;
}

/**
 * Resolves `"$self"` tokens in a permission `condition` against the caller's
 * identity. Resolution is keyed by the *enclosing* property name: `"$self"`
 * under `employeeId` (or a compound name ending in `EmployeeId`, e.g.
 * `absenceEmployeeId`) resolves to `identity.employeeId`; under `userId` (or
 * a compound name ending in `UserId`) it resolves to `identity.userId`.
 * Throws when the condition requires an identifier the caller doesn't have,
 * so a self-scoped grant never silently degrades into an unsatisfiable (or
 * worse, unfiltered) query.
 */
export function resolveCondition(
  condition: JsonObject,
  identity: SelfIdentity,
): JsonObject {
  return resolveValue(condition, undefined, identity) as JsonObject;
}

function resolveValue(
  value: JsonValue,
  key: string | undefined,
  identity: SelfIdentity,
): JsonValue {
  if (value === SELF_TOKEN) {
    return resolveSelfToken(key, identity);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveValue(entry, key, identity));
  }
  if (value !== null && typeof value === 'object') {
    const resolved: JsonObject = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveValue(v, k, identity);
    }
    return resolved;
  }
  return value;
}

function resolveSelfToken(
  key: string | undefined,
  identity: SelfIdentity,
): JsonValue {
  // Matches both the bare field (`employeeId`) and compound field names
  // that reference an employee (`absenceEmployeeId`, `replacementEmployeeId`,
  // ...) — every one of them means "the caller's own employeeId".
  if (key === 'employeeId' || key?.endsWith('EmployeeId')) {
    if (identity.employeeId === undefined) {
      throw new ForbiddenException(
        'Unable to resolve permission scope: caller has no linked employee',
      );
    }
    return identity.employeeId;
  }
  if (key === 'userId' || key?.endsWith('UserId')) {
    if (identity.userId === undefined) {
      throw new ForbiddenException(
        'Unable to resolve permission scope: caller has no user id',
      );
    }
    return identity.userId;
  }
  throw new ForbiddenException(
    `Unable to resolve permission scope: unsupported "$self" field "${key}"`,
  );
}
