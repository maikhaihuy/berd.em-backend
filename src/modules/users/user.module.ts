import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PasswordService } from '../../common/services/password.service';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';
import { AbilitiesModule } from '@modules/abilities/abilities.module';

@Module({
  imports: [PrismaModule, AuditLogsModule, AbilitiesModule],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
