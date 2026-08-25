import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { AuditLogMapper } from './audit-logs.mapper';

export interface RecordAuditLogInput {
  actorId: number;
  action: string;
  subject: string;
  entityId: number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Plain insert, no business logic — called by other services' mutation
   * methods after a successful write. Never called for a rejected/failed
   * mutation.
   *
   * Pass the transaction client (`tx`) as `client` when calling this from
   * inside a `$transaction` callback — using the app-wide `this.prisma`
   * there would insert outside the transaction, so an audit row could
   * commit even if the transaction it describes later rolls back.
   */
  async record(
    input: RecordAuditLogInput,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        subject: input.subject,
        entityId: input.entityId,
        before: (input.before ?? undefined) as Prisma.InputJsonValue,
        after: (input.after ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(filter: AuditLogFilterDto): Promise<AuditLogResponseDto[]> {
    const { subject, actorId, entityId, fromDate, toDate, page, limit } =
      filter;

    const where: Prisma.AuditLogWhereInput = {};
    if (subject) {
      where.subject = subject;
    }
    if (actorId) {
      where.actorId = actorId;
    }
    if (entityId) {
      where.entityId = entityId;
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit;

    const rows = await this.prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return AuditLogMapper.toDtos(rows);
  }
}
