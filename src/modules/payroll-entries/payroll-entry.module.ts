import { Module } from '@nestjs/common';
import { PayrollEntryService } from './payroll-entry.service';
import { PayrollEntriesController } from './payroll-entry.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [PayrollEntriesController],
  providers: [PayrollEntryService],
  exports: [PayrollEntryService],
})
export class PayrollEntriesModule {}
