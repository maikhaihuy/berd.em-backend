import { Prisma } from '@prisma/client';
import { uniqueConstraintFields } from './prisma-errors.helper';

function buildP2002(target: unknown): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

describe('uniqueConstraintFields', () => {
  it('maps a single conflicting column to that field', () => {
    const errors = uniqueConstraintFields(buildP2002(['phoneNumber']));
    expect(errors).toEqual({ phoneNumber: 'Already in use.' });
  });

  it('maps every conflicting column when more than one is reported', () => {
    const errors = uniqueConstraintFields(buildP2002(['phoneNumber', 'email']));
    expect(errors).toEqual({
      phoneNumber: 'Already in use.',
      email: 'Already in use.',
    });
  });

  it('handles a target given as a single string', () => {
    const errors = uniqueConstraintFields(buildP2002('phoneNumber'));
    expect(errors).toEqual({ phoneNumber: 'Already in use.' });
  });

  it('falls back to _general when no target is reported', () => {
    const errors = uniqueConstraintFields(buildP2002(undefined));
    expect(errors).toEqual({ _general: 'Already in use.' });
  });

  it('accepts a custom message', () => {
    const errors = uniqueConstraintFields(
      buildP2002(['phoneNumber']),
      'Custom message.',
    );
    expect(errors).toEqual({ phoneNumber: 'Custom message.' });
  });
});
