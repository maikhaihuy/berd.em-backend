/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('AuditLogsService', () => {
  let prisma: Partial<PrismaService>;
  let service: AuditLogsService;

  const row = {
    id: 1,
    actorId: 1,
    action: 'create',
    subject: 'roles',
    entityId: 1,
    before: null,
    after: null,
    createdAt: new Date('2026-05-15T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      auditLog: { findMany: jest.fn().mockResolvedValue([row]) } as any,
    };
    service = new AuditLogsService(prisma as PrismaService);
  });

  describe('record', () => {
    it('inserts a row via the app-wide client by default', async () => {
      const create = jest.fn().mockResolvedValue({});
      const client = { auditLog: { create } } as any;
      const svc = new AuditLogsService(client);

      await svc.record({
        actorId: 1,
        action: 'create',
        subject: 'roles',
        entityId: 5,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 1,
            action: 'create',
            subject: 'roles',
            entityId: 5,
          }),
        }),
      );
    });

    it('inserts via an explicitly passed transaction client', async () => {
      const txCreate = jest.fn().mockResolvedValue({});
      const tx = { auditLog: { create: txCreate } } as any;

      await service.record(
        { actorId: 1, action: 'delete', subject: 'roles', entityId: 5 },
        tx,
      );

      expect(txCreate).toHaveBeenCalled();
      expect((prisma.auditLog as any).findMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters by subject', async () => {
      await service.findAll({ subject: 'roles' } as any);

      expect((prisma.auditLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subject: 'roles' }),
        }),
      );
    });

    it('filters by actorId', async () => {
      await service.findAll({ actorId: 7 } as any);

      expect((prisma.auditLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorId: 7 }),
        }),
      );
    });

    it('filters by entityId', async () => {
      await service.findAll({ entityId: 42 } as any);

      expect((prisma.auditLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityId: 42 }),
        }),
      );
    });

    it('applies a fromDate/toDate range', async () => {
      await service.findAll({
        fromDate: '2026-05-01T00:00:00Z',
        toDate: '2026-05-31T23:59:59Z',
      } as any);

      expect((prisma.auditLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-05-01T00:00:00Z'),
              lte: new Date('2026-05-31T23:59:59Z'),
            },
          }),
        }),
      );
    });

    it('applies page/limit as skip/take', async () => {
      await service.findAll({ page: 3, limit: 20 } as any);

      expect((prisma.auditLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it('orders newest first', async () => {
      await service.findAll({} as any);

      expect((prisma.auditLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('maps rows to response DTOs', async () => {
      const result = await service.findAll({} as any);

      expect(result).toEqual([
        expect.objectContaining({ id: row.id, subject: row.subject }),
      ]);
    });
  });
});
