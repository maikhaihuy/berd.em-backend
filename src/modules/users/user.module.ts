import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PasswordService } from '../../common/services/password.service';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';
import { AbilitiesModule } from '@modules/abilities/abilities.module';
import { PasswordResetTokenModule } from '@modules/auth/password-reset-token.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    AbilitiesModule,
    PasswordResetTokenModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
