import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { EmployeesModule } from '@modules/employees/employees.module';
import { ShiftsModule } from '@modules/shifts/shifts.module';
// import { TimeTrackingModule } from '@modules/time-tracking/time-tracking.module';
import { BranchesModule } from '@modules/branches/branches.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
// import { CaslModule } from '@modules/casl/casl.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { EmployeeHourlyRatesModule } from '@modules/employee-hourly-rates/employee-hourly-rates.module';
import { AvailabilityModule } from '@modules/availability/availability.module';
import { ScheduleModule } from '@modules/schedule/schedule.module';

@Module({
  imports: [
    EmployeeHourlyRatesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    // CaslModule,
    AuthModule,
    UsersModule,
    EmployeesModule,
    RolesModule,
    PermissionsModule,
    ShiftsModule,
    //TimeTrackingModule,
    BranchesModule,
    AvailabilityModule,
    ScheduleModule,
  ],
  // providers: [
  //   {
  //     provide: APP_FILTER,
  //     useClass: HttpExceptionFilter,
  //   },
  //   {
  //     provide: APP_INTERCEPTOR,
  //     useClass: TransformInterceptor,
  //   },
  // ],
})
export class AppModule {}
