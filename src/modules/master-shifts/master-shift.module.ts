import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { MasterShiftsController } from './master-shift.controller';
import { MasterShiftsService } from './master-shift.service';

@Module({
  imports: [PrismaModule],
  controllers: [MasterShiftsController],
  providers: [MasterShiftsService],
  exports: [MasterShiftsService],
})
export class MasterShiftsModule {}
