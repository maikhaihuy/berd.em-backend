import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { SubShiftTemplatesController } from './sub-shift-template.controller';
import { SubShiftTemplatesService } from './sub-shift-template.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubShiftTemplatesController],
  providers: [SubShiftTemplatesService],
  exports: [SubShiftTemplatesService],
})
export class SubShiftTemplatesModule {}
