import { Inject, Injectable } from '@nestjs/common';
import { AbilityBuilder, ForcedSubject, PureAbility } from '@casl/ability';
import { createPrismaAbility, PrismaQuery } from '@casl/prisma';
import { LoggerService } from '@common/logger/logger.service';
import {
  JsonObject,
  resolveCondition,
  SelfIdentity,
} from '@common/guards/permission-condition.helper';

/**
 * A subject is either a bare type string (`'time-logs'`, for type-level
 * `ability.can(action, subject)` checks) or a plain object tagged with its
 * subject type via `subject('time-logs', row)` (for instance-level checks
 * against a fetched row — Prisma rows have no discriminator CASL could
 * otherwise infer).
 */
export type AppSubjects = string | (object & ForcedSubject<string>);
export type AppAbility = PureAbility<[string, AppSubjects], PrismaQuery>;

export interface CaslUser extends SelfIdentity {
  permissions: {
    action: string;
    subject: string;
    condition?: JsonObject | null;
  }[];
}

/**
 * Builds one CASL `Ability` per request from a user's granted permissions.
 * Each granted `(action, subject)` becomes one CASL rule; a grant's own
 * `condition` (from that specific `RolePermission` row) is resolved for
 * `$self` and attached as that rule's conditions. `manage`/`all` need no
 * special handling here — they're `@casl/ability`'s own built-in wildcard
 * conventions.
 *
 * A grant whose condition can't be resolved (missing identifier, or an
 * unrecognized token) is dropped — logged as a warning and excluded from
 * the built `Ability` — rather than throwing. This never builds an `Ability`
 * with a broken rule, but it also never lets one bad grant sour a request
 * the caller's *other* grants would otherwise satisfy; see the
 * `authorization` spec's "Unresolvable `$self` token denies the request"
 * requirement.
 */
@Injectable()
export class CaslAbilityFactory {
  constructor(@Inject(LoggerService) private readonly logger: LoggerService) {}

  createForUser(user: CaslUser): AppAbility {
    const { can: rawCan, build } = new AbilityBuilder<AppAbility>(
      createPrismaAbility,
    );
    // `AbilityBuilder<PureAbility<[string, string], PrismaQuery>>['can']`'s
    // generic overloads can't infer a conditions parameter for a bare
    // `[string, string]` subject tuple (there's no subject class/tag for
    // TS to key `InstanceOf<>` off of) — our subjects are genuinely dynamic
    // strings loaded from the DB, so this is retyped once here to the
    // simple, correct-at-runtime shape instead of casting at every call.
    const can = rawCan as (
      action: string,
      subject: string,
      conditions?: PrismaQuery,
    ) => void;

    for (const permission of user.permissions) {
      if (!permission.condition) {
        can(permission.action, permission.subject);
        continue;
      }

      try {
        const condition = resolveCondition(permission.condition, user);
        can(permission.action, permission.subject, condition);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          {
            action: permission.action,
            subject: permission.subject,
            reason,
          },
          CaslAbilityFactory.name,
        );
        // Rule dropped: not added to the ability being built.
      }
    }

    return build();
  }
}
