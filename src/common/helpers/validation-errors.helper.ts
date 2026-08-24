import { ValidationError } from 'class-validator';

function isArrayIndex(property: string): boolean {
  return /^\d+$/.test(property);
}

function pathFor(parentPath: string, property: string): string {
  if (!parentPath) return property;
  return isArrayIndex(property)
    ? `${parentPath}[${property}]`
    : `${parentPath}.${property}`;
}

function collect(
  errors: ValidationError[],
  parentPath: string,
  errorMap: Record<string, string[]>,
): void {
  for (const err of errors) {
    const path = pathFor(parentPath, err.property);

    if (err.constraints) {
      const messages = Object.values(err.constraints);
      errorMap[path] = [...(errorMap[path] ?? []), ...messages];
    }

    if (err.children && err.children.length > 0) {
      collect(err.children, path, errorMap);
    }
  }
}

/**
 * Flattens class-validator's ValidationError tree into a field-path -> messages map,
 * preserving nested/array paths (e.g. `employee.email`, `items[0].quantity`) and
 * aggregating every failed constraint per path instead of overwriting.
 */
export function buildValidationErrorMap(
  errors: ValidationError[],
): Record<string, string[]> {
  const errorMap: Record<string, string[]> = {};
  collect(errors, '', errorMap);
  return errorMap;
}
