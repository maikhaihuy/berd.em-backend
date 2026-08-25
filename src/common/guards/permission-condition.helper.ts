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
const MANAGED_BRANCHES_TOKEN = '$managedBranches';

export interface SelfIdentity {
  employeeId?: number;
  userId?: number;
  managedBranches?: number[];
}

/**
 * The `$self` field-name convention: a bare field name or a compound name
 * ending in the given suffix resolves to the matching identity value.
 * Shared between `resolveSelfToken` and the `GET /permissions/catalog`
 * endpoint so the documented convention can never drift from the code that
 * actually implements it.
 */
export const SELF_RESOLVABLE_FIELDS: {
  bareField: 'employeeId' | 'userId';
  suffix: 'EmployeeId' | 'UserId';
}[] = [
  { bareField: 'employeeId', suffix: 'EmployeeId' },
  { bareField: 'userId', suffix: 'UserId' },
];

/**
 * Resolves `"$self"` tokens in a permission `condition` against the caller's
 * identity. Resolution is keyed by the *enclosing* property name: `"$self"`
 * under `employeeId` (or a compound name ending in `EmployeeId`, e.g.
 * `absenceEmployeeId`) resolves to `identity.employeeId`; under `userId` (or
 * a compound name ending in `UserId`) it resolves to `identity.userId`.
 * Throws when the condition requires an identifier the caller doesn't have,
 * so a self-scoped grant never silently degrades into an unsatisfiable (or
 * worse, unfiltered) query.
 *
 * Resolves `"$managedBranches"` tokens (anywhere in the condition, typically
 * as the operand of an `in` filter on a `branchId` field, e.g.
 * `{ branchId: { in: "$managedBranches" } }`) to the caller's list of
 * managed branch ids. Unlike `$self`, an empty list is a valid resolution —
 * "the caller manages no branches" is not a missing identifier, so this
 * never throws.
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
  if (value === MANAGED_BRANCHES_TOKEN) {
    return resolveManagedBranchesToken(identity);
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
  for (const { bareField, suffix } of SELF_RESOLVABLE_FIELDS) {
    if (key === bareField || key?.endsWith(suffix)) {
      const identityValue = identity[bareField];
      if (identityValue === undefined) {
        throw new ForbiddenException(
          `Unable to resolve permission scope: caller has no linked ${bareField === 'employeeId' ? 'employee' : 'user id'}`,
        );
      }
      return identityValue;
    }
  }
  throw new ForbiddenException(
    `Unable to resolve permission scope: unsupported "$self" field "${key}"`,
  );
}

function resolveManagedBranchesToken(identity: SelfIdentity): JsonValue {
  return identity.managedBranches ?? [];
}

/**
 * Which permission subjects a `$self` condition can meaningfully scope, and
 * which of that subject's fields it resolves against — the same fields
 * `resolveSelfToken` matches at request time. Backs `GET
 * /permissions/catalog` so the frontend condition editor doesn't hardcode
 * this list; kept here so the catalog can never drift from the resolver.
 */
export const SELF_SCOPABLE_SUBJECT_FIELDS: Record<string, string[]> = {
  'employee-hourly-rates': ['employeeId'],
  assignments: ['employeeId'],
  availability: ['employeeId'],
  'leave-requests': ['absenceEmployeeId', 'replacementEmployeeId'],
  'time-logs': ['employeeId'],
  'payroll-entries': ['employeeId'],
};

/**
 * Which permission subjects a `$managedBranches` condition can meaningfully
 * scope, keyed to the `branchId` field it resolves against. Same purpose as
 * `SELF_SCOPABLE_SUBJECT_FIELDS`, for the sibling token.
 */
export const MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS: Record<
  string,
  string[]
> = {
  'branch-schedule-configs': ['branchId'],
  'master-shift-templates': ['branchId'],
  'sub-shift-templates': ['branchId'],
  'task-templates': ['branchId'],
  'master-shifts': ['branchId'],
};
