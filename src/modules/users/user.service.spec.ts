/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';
import { Prisma } from '@prisma/client';

describe('UsersService', () => {
  let prisma: Partial<PrismaService>;
  let auditLogsService: { record: jest.Mock };
  let service: UsersService;

  const baseUser = {
    id: 1,
    phoneNumber: '0900000001',
    fullName: 'Test User',
    avatarUrl: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [{ userId: 1, roleId: 1, role: { id: 1, name: 'Employee' } }],
  };

  const twoRoleUser = {
    ...baseUser,
    userRoles: [
      { userId: 1, roleId: 1, role: { id: 1, name: 'Employee' } },
      { userId: 1, roleId: 2, role: { id: 2, name: 'Manager' } },
    ],
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      role: { findUnique: jest.fn(), findMany: jest.fn() } as any,
      userRole: { createMany: jest.fn(), delete: jest.fn() } as any,
      branch: { findMany: jest.fn() } as any,
      managerBranch: {
        createMany: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      } as any,
    };
    auditLogsService = { record: jest.fn() };
    service = new UsersService(
      prisma as PrismaService,
      auditLogsService as unknown as AuditLogsService,
    );
  });

  describe('create', () => {
    it('records an audit log entry on success', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(null);
      (prisma.role as any).findMany.mockResolvedValue([{ id: 1 }]);
      (prisma.user as any).create.mockResolvedValue(baseUser);

      await service.create(
        {
          phoneNumber: baseUser.phoneNumber,
          fullName: baseUser.fullName,
          roleIds: [1],
        } as any,
        99,
      );

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'create',
          subject: 'users',
          entityId: baseUser.id,
        }),
      );
    });

    it('throws BadRequestException when the phone number already exists', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(baseUser);

      await expect(
        service.create(
          {
            phoneNumber: baseUser.phoneNumber,
            fullName: baseUser.fullName,
            roleIds: [1],
          } as any,
          99,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a role id does not exist', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(null);
      (prisma.role as any).findMany.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.create(
          {
            phoneNumber: baseUser.phoneNumber,
            fullName: baseUser.fullName,
            roleIds: [1, 999],
          } as any,
          99,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('records an audit log entry with before/after snapshots on success', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(baseUser);
      (prisma.user as any).update.mockResolvedValue({
        ...baseUser,
        fullName: 'Updated Name',
      });

      await service.update(1, { fullName: 'Updated Name' } as any, 99);

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'update',
          subject: 'users',
          entityId: 1,
          before: expect.objectContaining({ fullName: baseUser.fullName }),
          after: expect.objectContaining({ fullName: 'Updated Name' }),
        }),
      );
    });

    it('throws NotFoundException without recording an audit entry when the user is missing', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(null);
      (prisma.user as any).update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Not found', {
          code: 'P2025',
          clientVersion: '6.13.0',
        }),
      );

      await expect(
        service.update(1, { fullName: 'x' } as any, 99),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('records an audit log entry with a before snapshot on success', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(baseUser);
      (prisma.user as any).delete.mockResolvedValue(baseUser);

      await service.remove(1, 99);

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'delete',
          subject: 'users',
          entityId: 1,
          before: expect.objectContaining({ id: 1 }),
        }),
      );
    });

    it('throws NotFoundException without recording an audit entry when the user is missing', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(null);
      (prisma.user as any).delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Not found', {
          code: 'P2025',
          clientVersion: '6.13.0',
        }),
      );

      await expect(service.remove(1, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('assignRoles', () => {
    it('adds a role and records an audit log entry with subject user-roles', async () => {
      (prisma.role as any).findMany.mockResolvedValue([{ id: 2 }]);
      (prisma.user as any).findUnique
        .mockResolvedValueOnce(baseUser) // before snapshot (via findOne)
        .mockResolvedValueOnce(twoRoleUser); // after refetch
      (prisma.userRole as any).createMany.mockResolvedValue({ count: 1 });

      const result = await service.assignRoles(1, [2], 99);

      expect(prisma.userRole!.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ userId: 1, roleId: 2 }],
          skipDuplicates: true,
        }),
      );
      expect(result.roles).toEqual([
        { id: 1, name: 'Employee' },
        { id: 2, name: 'Manager' },
      ]);
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'update',
          subject: 'user-roles',
          entityId: 1,
        }),
      );
    });

    it('throws BadRequestException when a role id does not exist', async () => {
      (prisma.role as any).findMany.mockResolvedValue([]);

      await expect(service.assignRoles(1, [999], 99)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.userRole!.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeRole', () => {
    it('rejects removing the user’s last remaining role', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(baseUser);

      await expect(service.removeRole(1, 1, 99)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.userRole!.delete).not.toHaveBeenCalled();
    });

    it('removes one of several roles and records an audit log entry', async () => {
      (prisma.user as any).findUnique
        .mockResolvedValueOnce(twoRoleUser) // before snapshot (via findOne)
        .mockResolvedValueOnce(baseUser); // after refetch
      (prisma.userRole as any).delete.mockResolvedValue({});

      const result = await service.removeRole(1, 2, 99);

      expect(prisma.userRole!.delete).toHaveBeenCalledWith({
        where: { userId_roleId: { userId: 1, roleId: 2 } },
      });
      expect(result.roles).toEqual([{ id: 1, name: 'Employee' }]);
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'update',
          subject: 'user-roles',
          entityId: 1,
        }),
      );
    });
  });

  describe('assignManagerBranches', () => {
    it('adds a managed branch and records an audit log entry with subject manager-branches', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(baseUser);
      (prisma.branch as any).findMany.mockResolvedValue([{ id: 3 }]);
      (prisma.managerBranch as any).findMany
        .mockResolvedValueOnce([]) // before
        .mockResolvedValueOnce([{ userId: 1, branchId: 3 }]); // after
      (prisma.managerBranch as any).createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.assignManagerBranches(1, [3], 99);

      expect(prisma.managerBranch!.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ userId: 1, branchId: 3 }],
          skipDuplicates: true,
        }),
      );
      expect(result).toEqual({ userId: 1, managedBranchIds: [3] });
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'update',
          subject: 'manager-branches',
          entityId: 1,
        }),
      );
    });

    it('throws BadRequestException when a branch id does not exist', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(baseUser);
      (prisma.branch as any).findMany.mockResolvedValue([]);

      await expect(
        service.assignManagerBranches(1, [999], 99),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.managerBranch!.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeManagerBranch', () => {
    it('removes a managed branch and records an audit log entry', async () => {
      (prisma.managerBranch as any).findMany
        .mockResolvedValueOnce([{ userId: 1, branchId: 3 }]) // before
        .mockResolvedValueOnce([]); // after
      (prisma.managerBranch as any).delete.mockResolvedValue({});

      const result = await service.removeManagerBranch(1, 3, 99);

      expect(prisma.managerBranch!.delete).toHaveBeenCalledWith({
        where: { userId_branchId: { userId: 1, branchId: 3 } },
      });
      expect(result).toEqual({ userId: 1, managedBranchIds: [] });
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'update',
          subject: 'manager-branches',
          entityId: 1,
        }),
      );
    });

    it('throws NotFoundException when the user does not manage that branch', async () => {
      (prisma.managerBranch as any).findMany.mockResolvedValue([]);
      (prisma.managerBranch as any).delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Not found', {
          code: 'P2025',
          clientVersion: '6.13.0',
        }),
      );

      await expect(
        service.removeManagerBranch(1, 3, 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
