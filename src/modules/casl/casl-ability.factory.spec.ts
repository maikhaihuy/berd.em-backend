import { ForbiddenException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { subject } from '@casl/ability';
import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  const whereFor = (
    ability: ReturnType<CaslAbilityFactory['createForUser']>,
    action: string,
    subjectType: string,
  ): unknown =>
    (accessibleBy(ability, action) as Record<string, unknown>)[subjectType];

  it('builds an unconditioned rule for a grant with no condition', () => {
    const ability = factory.createForUser({
      employeeId: 7,
      permissions: [{ action: 'read', subject: 'time-logs' }],
    });

    expect(ability.can('read', 'time-logs')).toBe(true);
    expect(whereFor(ability, 'read', 'time-logs')).toEqual({});
  });

  it('resolves $self into a conditioned rule', () => {
    const ability = factory.createForUser({
      employeeId: 42,
      permissions: [
        {
          action: 'read',
          subject: 'time-logs',
          condition: { employeeId: '$self' },
        },
      ],
    });

    expect(ability.can('read', 'time-logs')).toBe(true);
    expect(whereFor(ability, 'read', 'time-logs')).toEqual({
      OR: [{ employeeId: 42 }],
    });
  });

  it('resolves a nested $self token through a relation path', () => {
    const ability = factory.createForUser({
      employeeId: 42,
      permissions: [
        {
          action: 'read',
          subject: 'attendance-history',
          condition: { assignment: { is: { employeeId: '$self' } } },
        },
      ],
    });

    expect(whereFor(ability, 'read', 'attendance-history')).toEqual({
      OR: [{ assignment: { is: { employeeId: 42 } } }],
    });
  });

  it('throws when a condition needs an identifier the caller lacks', () => {
    expect(() =>
      factory.createForUser({
        permissions: [
          {
            action: 'read',
            subject: 'time-logs',
            condition: { employeeId: '$self' },
          },
        ],
      }),
    ).toThrow(ForbiddenException);
  });

  it('denies an action with no matching grant', () => {
    const ability = factory.createForUser({
      employeeId: 7,
      permissions: [{ action: 'read', subject: 'time-logs' }],
    });

    expect(ability.can('delete', 'time-logs')).toBe(false);
  });

  it('treats manage/all as CASL-native wildcards with no bespoke code', () => {
    const ability = factory.createForUser({
      employeeId: 1,
      permissions: [{ action: 'manage', subject: 'all' }],
    });

    expect(ability.can('delete', 'time-logs')).toBe(true);
    expect(ability.can('anything', 'whatever-subject')).toBe(true);
  });

  it('supports instance-level checks against a tagged row via subject()', () => {
    const ability = factory.createForUser({
      employeeId: 5,
      permissions: [
        {
          action: 'check-in',
          subject: 'assignments',
          condition: { employeeId: '$self' },
        },
      ],
    });

    expect(
      ability.can('check-in', subject('assignments', { employeeId: 5 })),
    ).toBe(true);
    expect(
      ability.can('check-in', subject('assignments', { employeeId: 999 })),
    ).toBe(false);
  });

  it("keeps one role's grant condition independent of another's for the same permission", () => {
    const employeeAbility = factory.createForUser({
      employeeId: 42,
      permissions: [
        {
          action: 'read',
          subject: 'time-logs',
          condition: { employeeId: '$self' },
        },
      ],
    });
    const managerAbility = factory.createForUser({
      employeeId: 7,
      permissions: [{ action: 'read', subject: 'time-logs' }],
    });

    expect(whereFor(employeeAbility, 'read', 'time-logs')).toEqual({
      OR: [{ employeeId: 42 }],
    });
    expect(whereFor(managerAbility, 'read', 'time-logs')).toEqual({});
  });
});
