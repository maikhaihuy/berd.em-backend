import { Module } from '@nestjs/common';
import { UserBranchesController } from './user-branches.controller';
import { UserBranchesService } from './user-branches.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserBranchesController],
  providers: [UserBranchesService],
  exports: [UserBranchesService],
})
export class UserBranchesModule {}
