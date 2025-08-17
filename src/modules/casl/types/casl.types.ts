// import { Ability, AbilityClass, InferSubjects } from '@casl/ability';
// import { PrismaQuery, Subjects } from '@casl/prisma';
// import {
//   Employee,
//   User,
//   Role,
//   Permission,
//   Branch,
//   Shift,
//   ShiftRequest,
//   ShiftSchedule,
//   TimeLog,
//   PayrollEntry,
// } from '@prisma/client';

// export type Actions =
//   | 'manage'
//   | 'create'
//   | 'read'
//   | 'update'
//   | 'delete'
//   | 'verify'
//   | 'punch_in';

// export type PrismaSubjects = Subjects<{
//   Employee: Employee;
//   User: User;
//   Role: Role;
//   Permission: Permission;
//   Branch: Branch;
//   Shift: Shift;
//   ShiftRequest: ShiftRequest;
//   ShiftSchedule: ShiftSchedule;
//   TimeLog: TimeLog;
//   PayrollEntry: PayrollEntry;
// }>;

// export type AppSubjects =
//   | InferSubjects<PrismaSubjects>
//   | 'all'
//   | 'ownShift'
//   | 'ownTimeLog';

// /**
//  * The application-wide CASL Ability type, parameterized by our custom Actions and Subjects.
//  */
// export type AppAbilityType = Ability<[Actions, AppSubjects], PrismaQuery>;

// /**
//  * Factory for creating AppAbility instances.
//  * Use this when instantiating abilities in your guards/services.
//  */
// export const AppAbility = Ability as AbilityClass<AppAbilityType>;
