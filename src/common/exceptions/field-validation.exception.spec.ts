import { HttpStatus } from '@nestjs/common';
import { FieldValidationException } from './field-validation.exception';

describe('FieldValidationException', () => {
  it('scopes a single field/message pair to that field', () => {
    const exception = new FieldValidationException(
      'phoneNumber',
      'Employee with this phone number already exists',
    );

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      message: 'Employee with this phone number already exists',
      errors: {
        phoneNumber: ['Employee with this phone number already exists'],
      },
    });
  });

  it('accepts multiple fields with a shared summary message', () => {
    const exception = new FieldValidationException(
      { phoneNumber: 'Already in use.', email: 'Already in use.' },
      'Email or phone already in use.',
    );

    expect(exception.getResponse()).toEqual({
      message: 'Email or phone already in use.',
      errors: {
        phoneNumber: ['Already in use.'],
        email: ['Already in use.'],
      },
    });
  });

  it('falls back to the first field message as the summary when none is given', () => {
    const exception = new FieldValidationException({
      branchIds: 'One or more branches do not exist',
    });

    expect((exception.getResponse() as { message: string }).message).toBe(
      'One or more branches do not exist',
    );
  });
});
