import { Module } from '@nestjs/common';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PasswordService } from '@common/services/password.service';

@Module({
  providers: [PasswordResetTokenService, PasswordService],
  exports: [PasswordResetTokenService],
})
export class PasswordResetTokenModule {}
