// import { Injectable } from '@nestjs/common';
// import { AbilityBuilder, ExtractSubjectType } from '@casl/ability';
// import { createPrismaAbility } from '@casl/prisma';
// import { Actions, AppAbilityType, AppSubjects } from './types/casl.types';
// import { User, Permission, Employee } from '@prisma/client';

// export interface UserWithRelations extends User {
//   roles?: {
//     role: {
//       permissions: {
//         permission: Permission;
//       }[];
//     };
//   }[];
//   employee?: Employee & {
//     branches?: {
//       branchId: number;
//     }[];
//   };
// }

// @Injectable()
// export class CaslAbilityFactory {
//   createForUser(user: UserWithRelations): AppAbilityType {
//     const { can, build } = new AbilityBuilder<AppAbilityType>(
//       createPrismaAbility,
//     );

//     if (!user.roles || user.roles.length === 0) {
//       // Default permissions for users without roles
//       can('read', 'ownShift');
//       can('read', 'ownTimeLog');
//       can('create', 'ShiftRequest');
//       can('punch_in', 'TimeLog');
//     } else {
//       // Build permissions from user roles
//       user.roles.forEach(({ role }) => {
//         role.permissions.forEach(({ permission }) => {
//           const action = permission.action as Actions;
//           const subject = permission.subject as AppSubjects;

//           if (subject === 'all') {
//             can(action, 'all');
//           } else {
//             can(action, subject as ExtractSubjectType<AppSubjects>);
//           }
//         });
//       });
//     }

//     // Dynamic permissions based on context
//     if (user.employee) {
//       // Employee can only read their own shift schedules
//       can('read', 'ShiftSchedule', { employeeId: user.employee.id });

//       // Employee can only read their own time logs
//       can('read', 'TimeLog', { employeeId: user.employee.id });

//       // Employee can only create shift requests for themselves
//       can('create', 'ShiftRequest', { employeeId: user.employee.id });

//       // Manager can read time logs for employees in their branch
//       const userBranches = user.employee.branches?.map((b) => b.branchId) || [];
//       if (
//         userBranches.length > 0 &&
//         this.hasPermission(user, 'read', 'TimeLog')
//       ) {
//         can('read', 'TimeLog', {
//           employee: {
//             branches: {
//               some: {
//                 branchId: {
//                   in: userBranches,
//                 },
//               },
//             },
//           },
//         } as any);
//       }
//     }

//     return build({
//       detectSubjectType: (item) =>
//         item.constructor as unknown as ExtractSubjectType<AppSubjects>,
//     });
//   }

//   private hasPermission(
//     user: UserWithRelations,
//     action: string,
//     subject: string,
//   ): boolean {
//     if (!user.roles) return false;

//     return user.roles.some(({ role }) =>
//       role.permissions.some(
//         ({ permission }) =>
//           permission.action === action &&
//           (permission.subject === subject || permission.subject === 'all'),
//       ),
//     );
//   }
// }
