import { Module } from '@nestjs/common';
import { EmployeesService } from './employee.service';
import { EmployeesController } from './employee.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PasswordService } from '@common/services/password.service';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, PasswordService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
