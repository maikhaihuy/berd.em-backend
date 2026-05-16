import { Module } from '@nestjs/common';
import { AttendanceHistoryService } from './attendance-history.service';
import { AttendanceHistoryController } from './attendance-history.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttendanceHistoryController],
  providers: [AttendanceHistoryService],
  exports: [AttendanceHistoryService],
})
export class AttendanceHistoryModule {}
