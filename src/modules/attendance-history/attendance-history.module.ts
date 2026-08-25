import { Module } from '@nestjs/common';
import { AttendanceHistoryService } from './attendance-history.service';
import { AttendanceHistoryController } from './attendance-history.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [AttendanceHistoryController],
  providers: [AttendanceHistoryService],
  exports: [AttendanceHistoryService],
})
export class AttendanceHistoryModule {}
