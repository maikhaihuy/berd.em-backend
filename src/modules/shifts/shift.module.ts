import { Module } from '@nestjs/common';
import { ShiftsService } from './shift.service';
import { ShiftsController } from './shift.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
})
export class ShiftsModule {}
