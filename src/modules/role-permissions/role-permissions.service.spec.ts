/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { RolePermissionsService } from './role-permissions.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('RolePermissionsService', () => {
  let prisma: Partial<PrismaService>;
  let service: RolePermissionsService;
  let auditLogsService: { record: jest.Mock };

  const buildRolePermission = (
    roleId: number,
    permissionId: number,
    condition: Record<string, unknown> | null = null,
  ) => ({
    roleId,
    permissionId,
    condition,
    role: { name: 'Employee' },
    permission: { action: 'read', subject: 'time-logs' },
  });

  beforeEach(() => {
    prisma = {
      role: { findUnique: jest.fn() } as any,
      permission: { findMany: jest.fn() } as any,
      rolePermission: {
        upsert: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      } as any,
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    auditLogsService = { record: jest.fn() };
    service = new RolePermissionsService(
      prisma as PrismaService,
      auditLogsService as any,
    );
  });

  describe('assignPermissions', () => {
    it('assigns a grant with a condition', async () => {
      (prisma.role as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.permission as any).findMany.mockResolvedValue([{ id: 10 }]);
      (prisma.rolePermission as any).upsert.mockResolvedValue(
        buildRolePermission(1, 10, { employeeId: '$self' }),
      );

      const result = await service.assignPermissions(
        {
          roleId: 1,
          grants: [{ permissionId: 10, condition: { employeeId: '$self' } }],
        },
        99,
      );

      expect((prisma.rolePermission as any).upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            roleId: 1,
            permissionId: 10,
            condition: { employeeId: '$self' },
          }),
          update: { condition: { employeeId: '$self' } },
        }),
      );
      expect(result[0].condition).toEqual({ employeeId: '$self' });
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'create',
          subject: 'role-permissions',
          entityId: 10,
        }),
      );
    });

    it('assigns a grant without a condition, leaving it unconditioned', async () => {
      (prisma.role as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.permission as any).findMany.mockResolvedValue([{ id: 10 }]);
      (prisma.rolePermission as any).upsert.mockResolvedValue(
        buildRolePermission(1, 10, null),
      );

      const result = await service.assignPermissions(
        { roleId: 1, grants: [{ permissionId: 10 }] },
        99,
      );

      expect((prisma.rolePermission as any).upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ condition: undefined }),
          update: { condition: Prisma.JsonNull },
        }),
      );
      expect(result[0].condition).toBeNull();
    });

    it('re-assigning clears a previous condition when none is supplied', async () => {
      (prisma.role as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.permission as any).findMany.mockResolvedValue([{ id: 10 }]);
      (prisma.rolePermission as any).upsert.mockResolvedValue(
        buildRolePermission(1, 10, null),
      );

      await service.assignPermissions(
        { roleId: 1, grants: [{ permissionId: 10 }] },
        99,
      );

      expect((prisma.rolePermission as any).upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { condition: Prisma.JsonNull } }),
      );
    });

    it('only touches the grants named in the request (additive)', async () => {
      (prisma.role as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.permission as any).findMany.mockResolvedValue([{ id: 20 }]);
      (prisma.rolePermission as any).upsert.mockResolvedValue(
        buildRolePermission(1, 20),
      );

      await service.assignPermissions(
        { roleId: 1, grants: [{ permissionId: 20 }] },
        99,
      );

      // Exactly one upsert call, scoped to the one requested permission —
      // nothing resembling a "delete everything else" or "set" operation.
      expect((prisma.rolePermission as any).upsert).toHaveBeenCalledTimes(1);
      expect((prisma.rolePermission as any).deleteMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the role does not exist', async () => {
      (prisma.role as any).findUnique.mockResolvedValue(null);

      await expect(
        service.assignPermissions(
          { roleId: 999, grants: [{ permissionId: 1 }] },
          99,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when a permission does not exist', async () => {
      (prisma.role as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.permission as any).findMany.mockResolvedValue([]);

      await expect(
        service.assignPermissions(
          { roleId: 1, grants: [{ permissionId: 999 }] },
          99,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removePermission', () => {
    it('records an audit log entry on success', async () => {
      (prisma.rolePermission as any).delete.mockResolvedValue({});

      await service.removePermission(1, 10, 99);

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'delete',
          subject: 'role-permissions',
          entityId: 10,
        }),
      );
    });
  });
});
