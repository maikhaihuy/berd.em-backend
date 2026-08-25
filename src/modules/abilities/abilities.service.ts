import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { userWithRolePermissionsInclude } from '@modules/users/user.types';
import {
  CaslAbilityFactory,
  CaslUser,
} from '@modules/casl/casl-ability.factory';
import { JsonObject } from '@common/guards/permission-condition.helper';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AbilityRuleDto } from './dto/ability-rule.dto';

@Injectable()
export class AbilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Serializes an already-built ability's rules. Reports what the caller
   * would actually get: post `$self`-resolution, and post the drop-rule
   * behavior for anything unresolvable — never the literal "$self" token.
   */
  private serialize(caslUser: CaslUser): AbilityRuleDto[] {
    const ability = this.caslAbilityFactory.createForUser(caslUser);
    return ability.rules.map((rule) => ({
      action: rule.action as string,
      subject: rule.subject as string,
      inverted: rule.inverted ?? false,
      conditions: rule.conditions as Record<string, unknown> | undefined,
    }));
  }

  /** Self-scoped: the caller's own identity/permissions are already loaded on the request. */
  getAbilitiesForCaller(caller: AuthenticatedUserDto): AbilityRuleDto[] {
    return this.serialize(caller as unknown as CaslUser);
  }

  /** Admin-scoped: loads the target user's identity/permissions fresh. */
  async getAbilitiesForUser(userId: number): Promise<AbilityRuleDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRolePermissionsInclude,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const caslUser: CaslUser = {
      userId: user.id,
      employeeId: user.employee?.id,
      permissions: user.role.rolePermissions.map((rp) => ({
        action: rp.permission.action,
        subject: rp.permission.subject,
        condition: rp.condition as JsonObject | null,
      })),
    };

    return this.serialize(caslUser);
  }
}
