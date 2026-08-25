import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AppAbility } from '@modules/casl/casl-ability.factory';

/**
 * Reads the CASL `Ability` `PermissionsGuard` built for the caller and
 * attached to the request. Services use it with `accessibleBy(ability,
 * action)[subject]` to build a row-scoping Prisma `where` filter.
 */
export const CaslAbility = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppAbility => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { ability?: AppAbility }>();
    return request.ability!;
  },
);
