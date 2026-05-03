import { Module } from '@nestjs/common';
import { WorkSlotsService } from './work-slots.service';
import { WorkSlotsController } from './work-slots.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkSlotsController],
  providers: [WorkSlotsService],
  exports: [WorkSlotsService],
})
export class WorkSlotsModule {}
