import { ForbiddenException } from '@nestjs/common';
import { resolveCondition } from './permission-condition.helper';

describe('resolveCondition', () => {
  it('resolves a flat $self token under employeeId', () => {
    expect(
      resolveCondition({ employeeId: '$self' }, { employeeId: 42 }),
    ).toEqual({ employeeId: 42 });
  });

  it('resolves a $self token under userId', () => {
    expect(resolveCondition({ userId: '$self' }, { userId: 7 })).toEqual({
      userId: 7,
    });
  });

  it('resolves a $self token under a compound EmployeeId field name', () => {
    expect(
      resolveCondition({ absenceEmployeeId: '$self' }, { employeeId: 42 }),
    ).toEqual({ absenceEmployeeId: 42 });
  });

  it('resolves a $self token under a compound UserId field name', () => {
    expect(
      resolveCondition({ approvedUserId: '$self' }, { userId: 7 }),
    ).toEqual({ approvedUserId: 7 });
  });

  it('resolves a nested $self token through a relation path', () => {
    expect(
      resolveCondition(
        { assignment: { employeeId: '$self' } },
        { employeeId: 42 },
      ),
    ).toEqual({ assignment: { employeeId: 42 } });
  });

  it('leaves non-$self values untouched', () => {
    expect(
      resolveCondition(
        { status: 'ACTIVE', employeeId: '$self' },
        { employeeId: 42 },
      ),
    ).toEqual({ status: 'ACTIVE', employeeId: 42 });
  });

  it('throws when employeeId is required but the caller has none', () => {
    expect(() => resolveCondition({ employeeId: '$self' }, {})).toThrow(
      ForbiddenException,
    );
  });

  it('throws when userId is required but the caller has none', () => {
    expect(() => resolveCondition({ userId: '$self' }, {})).toThrow(
      ForbiddenException,
    );
  });

  it('throws on an unsupported $self field', () => {
    expect(() =>
      resolveCondition({ branchId: '$self' }, { employeeId: 42 }),
    ).toThrow(ForbiddenException);
  });
});
