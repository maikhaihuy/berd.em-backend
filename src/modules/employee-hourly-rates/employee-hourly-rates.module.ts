import { Module } from '@nestjs/common';
import { EmployeeHourlyRatesService } from './employee-hourly-rates.service';
import { EmployeeHourlyRatesController } from './employee-hourly-rates.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeHourlyRatesController, EmployeeHourlyRatesController],
  providers: [EmployeeHourlyRatesService, EmployeeHourlyRatesService],
})
export class EmployeeHourlyRatesModule {}
