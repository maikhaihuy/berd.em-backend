import { BadRequestException } from '@nestjs/common';

/**
 * A 400 response scoped to one or more specific request fields.
 *
 * GlobalExceptionFilter forwards any `errors` map found on a BadRequestException's
 * body as-is; throwing this instead of a plain BadRequestException(message) lets a
 * business-rule check (e.g. a manual uniqueness pre-check) attach the field it's
 * actually about, instead of falling back to `errors._general`.
 */
export class FieldValidationException extends BadRequestException {
  constructor(field: string, message: string);
  constructor(fields: Record<string, string | string[]>, message?: string);
  constructor(
    fieldOrFields: string | Record<string, string | string[]>,
    message?: string,
  ) {
    const errors: Record<string, string[]> =
      typeof fieldOrFields === 'string'
        ? { [fieldOrFields]: [message as string] }
        : Object.fromEntries(
            Object.entries(fieldOrFields).map(([field, messages]) => [
              field,
              Array.isArray(messages) ? messages : [messages],
            ]),
          );

    const summary =
      typeof fieldOrFields === 'string'
        ? (message as string)
        : (message ?? Object.values(errors)[0]?.[0] ?? 'Validation failed');

    super({ message: summary, errors });
  }
}
