import { Prisma } from '@prisma/client';

/**
 * Reads the column(s) reported on a P2002 (unique constraint) error's `meta.target`
 * and returns a field -> message map suitable for FieldValidationException, so the
 * client finds out which field actually collided instead of a generic message.
 */
export function uniqueConstraintFields(
  error: Prisma.PrismaClientKnownRequestError,
  message = 'Already in use.',
): Record<string, string> {
  const target: unknown = error.meta?.target;
  const fields: string[] = Array.isArray(target)
    ? target.filter((value): value is string => typeof value === 'string')
    : typeof target === 'string'
      ? [target]
      : [];

  if (fields.length === 0) {
    return { _general: message };
  }

  const errors: Record<string, string> = {};
  for (const field of fields) {
    errors[field] = message;
  }
  return errors;
}
