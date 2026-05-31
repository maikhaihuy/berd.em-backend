import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { MasterShiftTemplatesController } from './master-shift-template.controller';
import { MasterShiftTemplatesService } from './master-shift-template.service';

@Module({
  imports: [PrismaModule],
  controllers: [MasterShiftTemplatesController],
  providers: [MasterShiftTemplatesService],
  exports: [MasterShiftTemplatesService],
})
export class MasterShiftTemplatesModule {}
