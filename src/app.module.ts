import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/user.module';
import { EmployeesModule } from '@modules/employees/employee.module';
import { ShiftsModule } from '@modules/shifts/shift.module';
import { BranchesModule } from '@modules/branches/branch.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { RolesModule } from './modules/roles/role.module';
import { PermissionsModule } from './modules/permissions/permission.module';
import { RolePermissionsModule } from './modules/role-permissions/role-permissions.module';
import { EmployeeHourlyRatesModule } from '@modules/employee-hourly-rates/employee-hourly-rates.module';
import { AvailabilityModule } from '@modules/availability/availability.module';
// NOTE: ScheduleModule and RosterModule have been REMOVED (deprecated in ERD v0.3.1)
// These are fully replaced by WorkSlotModule - modules deleted from codebase
import { ExceptionModule } from '@common/exception.module';
import { validate } from '@common/env.validation';
import { WorkSlotsModule } from './modules/work-slots/work-slot.module';
import { AttendanceHistoryModule } from './modules/attendance-history/attendance-history.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';

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
    UsersModule,
    RolesModule,
    PermissionsModule,
    RolePermissionsModule,
    // Core Entities
    EmployeesModule,
    EmployeeHourlyRatesModule,
    BranchesModule,
    ShiftsModule,
    AvailabilityModule,
    WorkSlotsModule,
    // Shift Management (WorkSlot replaces Schedule + Roster)
    // ✅ WorkSlotModule created and registered
    AttendanceHistoryModule,
    LeaveRequestsModule,
    // Payment Management
    TimeTrackingModule,
    // TODO: Add PayPeriodsModule when created
    // TODO: Add PayrollEntriesModule when created
  ],
})
export class AppModule {}
