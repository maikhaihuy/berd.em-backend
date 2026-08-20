import { Module } from '@nestjs/common';
import { BranchScheduleConfigService } from './branch-schedule-config.service';
import { BranchScheduleConfigsController } from './branch-schedule-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BranchScheduleConfigsController],
  providers: [BranchScheduleConfigService],
  exports: [BranchScheduleConfigService],
})
export class BranchScheduleConfigsModule {}
