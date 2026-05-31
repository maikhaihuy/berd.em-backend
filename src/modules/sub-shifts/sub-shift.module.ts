import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { SubShiftsController } from './sub-shift.controller';
import { SubShiftsService } from './sub-shift.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubShiftsController],
  providers: [SubShiftsService],
  exports: [SubShiftsService],
})
export class SubShiftsModule {}
