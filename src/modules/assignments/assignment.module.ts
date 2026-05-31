import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { AssignmentsController } from './assignment.controller';
import { AssignmentsService } from './assignment.service';

@Module({
  imports: [PrismaModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
