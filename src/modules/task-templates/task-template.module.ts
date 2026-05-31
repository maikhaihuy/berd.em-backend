import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { TaskTemplatesController } from './task-template.controller';
import { TaskTemplatesService } from './task-template.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaskTemplatesController],
  providers: [TaskTemplatesService],
  exports: [TaskTemplatesService],
})
export class TaskTemplatesModule {}
