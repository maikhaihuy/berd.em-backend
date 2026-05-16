import { Module } from '@nestjs/common';
import { WorkSlotsService } from './work-slot.service';
import { WorkSlotsController } from './work-slot.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkSlotsController],
  providers: [WorkSlotsService],
  exports: [WorkSlotsService],
})
export class WorkSlotsModule {}
