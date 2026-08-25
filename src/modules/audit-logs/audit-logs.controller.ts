import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @RequirePermissions({ action: 'read', subject: 'audit-logs' })
  @Get()
  @ApiOperation({ summary: 'List audit log entries' })
  @ApiResponse({
    status: 200,
    description: 'List of audit log entries, newest first',
    type: [AuditLogResponseDto],
  })
  async findAll(
    @Query() filter: AuditLogFilterDto,
  ): Promise<AuditLogResponseDto[]> {
    return this.auditLogsService.findAll(filter);
  }
}
