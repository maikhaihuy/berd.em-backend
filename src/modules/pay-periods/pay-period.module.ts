import { Module } from '@nestjs/common';
import { PayPeriodService } from './pay-period.service';
import { PayPeriodsController } from './pay-period.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PayPeriodsController],
  providers: [PayPeriodService],
  exports: [PayPeriodService],
})
export class PayPeriodsModule {}
