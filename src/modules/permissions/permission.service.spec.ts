/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { PermissionsService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';

describe('PermissionsService', () => {
  let prisma: Partial<PrismaService>;
  let service: PermissionsService;

  beforeEach(() => {
    prisma = {
      permission: { findMany: jest.fn() } as any,
    };
    service = new PermissionsService(
      prisma as PrismaService,
      { record: jest.fn() } as unknown as AuditLogsService,
    );
  });

  describe('getCatalog', () => {
    it('includes $self for a self-scopable subject like time-logs', async () => {
      (prisma.permission as any).findMany.mockResolvedValue([
        { subject: 'time-logs', action: 'read' },
        { subject: 'time-logs', action: 'create' },
      ]);

      const catalog = await service.getCatalog();

      expect(catalog).toEqual([
        {
          subject: 'time-logs',
          actions: ['create', 'read'],
          conditionTokens: [{ token: '$self', fields: ['employeeId'] }],
        },
      ]);
    });

    it('includes $managedBranches for a branch-scopable subject like master-shifts', async () => {
      (prisma.permission as any).findMany.mockResolvedValue([
        { subject: 'master-shifts', action: 'read' },
      ]);

      const catalog = await service.getCatalog();

      expect(catalog).toEqual([
        {
          subject: 'master-shifts',
          actions: ['read'],
          conditionTokens: [
            { token: '$managedBranches', fields: ['branchId'] },
          ],
        },
      ]);
    });

    it('returns an empty condition-tokens array for a subject with neither', async () => {
      (prisma.permission as any).findMany.mockResolvedValue([
        { subject: 'roles', action: 'read' },
      ]);

      const catalog = await service.getCatalog();

      expect(catalog).toEqual([
        { subject: 'roles', actions: ['read'], conditionTokens: [] },
      ]);
    });
  });
});
