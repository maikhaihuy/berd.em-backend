// import {
//   Injectable,
//   CanActivate,
//   ExecutionContext,
//   ForbiddenException,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import {
//   CaslAbilityFactory,
//   UserWithRelations,
// } from '../../modules/casl/casl-ability.factory';
// import { CHECK_ABILITY, RequiredRule } from '../decorators/abilities.decorator';
// import { ForbiddenError } from '@casl/ability';
// import { Request } from 'express';

// @Injectable()
// export class AbilitiesGuard implements CanActivate {
//   constructor(
//     private reflector: Reflector,
//     private caslAbilityFactory: CaslAbilityFactory,
//   ) {}

//   canActivate(context: ExecutionContext): boolean {
//     const rules = this.reflector.getAllAndOverride<RequiredRule[]>(
//       CHECK_ABILITY,
//       [context.getHandler(), context.getClass()],
//     );

//     if (!rules) {
//       return true;
//     }

//     const request = context.switchToHttp().getRequest<Request>();
//     const user = request.user;

//     if (!user) {
//       throw new ForbiddenException('User not authenticated');
//     }

//     const ability = this.caslAbilityFactory.createForUser(
//       user as UserWithRelations,
//     );

//     try {
//       for (const rule of rules) {
//         const subject =
//           typeof rule.subject === 'function'
//             ? rule.subject(request)
//             : rule.subject;
//         ForbiddenError.from(ability).throwUnlessCan(
//           rule.action,
//           subject,
//           rule.field,
//         );
//       }
//       return true;
//     } catch (error) {
//       if (error instanceof ForbiddenError) {
//         throw new ForbiddenException(error.message);
//       }
//       throw error;
//     }
//   }
// }
