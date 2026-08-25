import { Module } from '@nestjs/common';
import { PermissionsService } from './permission.service';
import { PermissionsController } from './permission.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogsModule } from '@modules/audit-logs/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
