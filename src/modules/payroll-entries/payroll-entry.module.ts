import { Module } from '@nestjs/common';
import { PayrollEntryService } from './payroll-entry.service';
import { PayrollEntriesController } from './payroll-entry.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PayrollEntriesController],
  providers: [PayrollEntryService],
  exports: [PayrollEntryService],
})
export class PayrollEntriesModule {}
