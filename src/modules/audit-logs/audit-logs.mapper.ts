import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { AuditLogRow } from './audit-logs.types';

export class AuditLogMapper {
  static toDto(this: void, row: AuditLogRow): AuditLogResponseDto {
    return {
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      subject: row.subject,
      entityId: row.entityId,
      before: row.before as Record<string, unknown> | null,
      after: row.after as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }

  static toDtos(rows: AuditLogRow[]): AuditLogResponseDto[] {
    return rows.map(AuditLogMapper.toDto);
  }
}
