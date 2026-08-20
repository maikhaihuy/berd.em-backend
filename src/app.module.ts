import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/user.module';
import { EmployeesModule } from '@modules/employees/employee.module';
import { BranchesModule } from '@modules/branches/branch.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { RolesModule } from './modules/roles/role.module';
import { PermissionsModule } from './modules/permissions/permission.module';
import { RolePermissionsModule } from './modules/role-permissions/role-permissions.module';
import { EmployeeHourlyRatesModule } from '@modules/employee-hourly-rates/employee-hourly-rates.module';
import { AvailabilityModule } from '@modules/availability/availability.module';
import { ExceptionModule } from '@common/exception.module';
import { AuthzModule } from '@common/authz.module';
import { validate } from '@common/env.validation';
import { AttendanceHistoryModule } from './modules/attendance-history/attendance-history.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';
import { MasterShiftTemplatesModule } from './modules/master-shift-templates/master-shift-template.module';
import { SubShiftTemplatesModule } from './modules/sub-shift-templates/sub-shift-template.module';
import { TaskTemplatesModule } from './modules/task-templates/task-template.module';
import { MasterShiftsModule } from './modules/master-shifts/master-shift.module';
import { SubShiftsModule } from './modules/sub-shifts/sub-shift.module';
import { AssignmentsModule } from './modules/assignments/assignment.module';
import { TasksModule } from './modules/tasks/task.module';
import { PayPeriodsModule } from './modules/pay-periods/pay-period.module';
import { PayrollEntriesModule } from './modules/payroll-entries/payroll-entry.module';
import { BranchScheduleConfigsModule } from './modules/branch-schedule-configs/branch-schedule-config.module';

@Module({
  imports: [
    ExceptionModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    PrismaModule,
    // Authentication & Authorization
    AuthModule,
    AuthzModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    RolePermissionsModule,
    // Core Entities
    EmployeesModule,
    EmployeeHourlyRatesModule,
    BranchesModule,
    BranchScheduleConfigsModule,
    // Shift and task domain
    MasterShiftTemplatesModule,
    SubShiftTemplatesModule,
    TaskTemplatesModule,
    MasterShiftsModule,
    SubShiftsModule,
    AssignmentsModule,
    TasksModule,
    AvailabilityModule,
    AttendanceHistoryModule,
    LeaveRequestsModule,
    // Payment Management
    TimeTrackingModule,
    PayPeriodsModule,
    PayrollEntriesModule,
  ],
})
export class AppModule {}
