import { accessibleBy } from '@casl/prisma';
import { subject } from '@casl/ability';
import { CaslAbilityFactory } from './casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;
  let logger: jest.Mocked<Pick<LoggerService, 'warn'>>;

  beforeEach(() => {
    logger = { warn: jest.fn() };
    factory = new CaslAbilityFactory(logger as unknown as LoggerService);
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

  describe('fail-closed: drop the rule, log a warning, never throw', () => {
    it('drops a rule whose condition needs an identifier the caller lacks, instead of throwing', () => {
      const ability = factory.createForUser({
        permissions: [
          {
            action: 'read',
            subject: 'time-logs',
            condition: { employeeId: '$self' },
          },
        ],
      });

      expect(ability.can('read', 'time-logs')).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'read', subject: 'time-logs' }),
        'CaslAbilityFactory',
      );
    });

    it('a caller with one resolvable and one unresolvable grant for the same route is still authorized', () => {
      const ability = factory.createForUser({
        permissions: [
          {
            action: 'read',
            subject: 'time-logs',
            condition: { employeeId: '$self' }, // unresolvable: no employeeId
          },
          { action: 'read', subject: 'time-logs' }, // unconditioned, resolvable
        ],
      });

      expect(ability.can('read', 'time-logs')).toBe(true);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('drops a rule with an unrecognized condition token the same way', () => {
      const ability = factory.createForUser({
        employeeId: 42,
        permissions: [
          {
            action: 'read',
            subject: 'time-logs',
            condition: { branchId: '$self' },
          },
        ],
      });

      expect(ability.can('read', 'time-logs')).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'read', subject: 'time-logs' }),
        'CaslAbilityFactory',
      );
    });
  });
});
