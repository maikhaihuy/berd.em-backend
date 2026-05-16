import { Module } from '@nestjs/common';
import { BranchesService } from './branch.service';
import { BranchesController } from './branch.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
