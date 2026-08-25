/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesService } from './role.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';
import { UpdateRoleDto } from './dto/update-role.dto';

describe('RolesService', () => {
  let service: RolesService;
  let auditLogsService: { record: jest.Mock };
  let prisma: {
    role: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    permission: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permission: { findMany: jest.fn() },
    };
    auditLogsService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('updates only name/description, never touching permission data', async () => {
      prisma.role.findFirst.mockResolvedValue(null);
      prisma.role.update.mockResolvedValue({
        id: 1,
        name: 'Renamed',
        description: null,
        rolePermissions: [],
      });

      const dto: UpdateRoleDto = { name: 'Renamed' };
      await service.update(1, dto, 99);

      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ name: 'Renamed', updatedBy: 99 }),
        }),
      );
      // The fixed bug wrote a `permissions: { set: ... } }` block keyed off
      // a nonexistent relation; confirm it's gone from the update payload.
      const call = prisma.role.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data).not.toHaveProperty('permissions');
      expect(prisma.permission.findMany).not.toHaveBeenCalled();
    });

    it('rejects a duplicate name', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 2, name: 'Manager' });

      await expect(
        service.update(1, { name: 'Manager' }, 99),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('does not run the duplicate-name check when name is not being updated', async () => {
      // Regression test: `where: { name: undefined }` is silently dropped by
      // Prisma, so running findFirst unconditionally would match the first
      // *other* role in the table and false-positive as a duplicate even
      // though `name` isn't part of this update at all.
      prisma.role.update.mockResolvedValue({
        id: 1,
        name: 'Employee',
        description: 'updated',
        rolePermissions: [],
      });

      await service.update(1, { description: 'updated' }, 99);

      expect(prisma.role.findFirst).not.toHaveBeenCalled();
      expect(prisma.role.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when the role does not exist', async () => {
      prisma.role.findFirst.mockResolvedValue(null);
      const { Prisma } = jest.requireActual('@prisma/client');
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'not found',
        { code: 'P2025', clientVersion: 'test' },
      );
      prisma.role.update.mockRejectedValue(prismaError);

      await expect(service.update(1, { name: 'X' }, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('rejects deleting a system role without calling prisma.role.delete', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 2,
        name: 'Manager',
        isSystemRole: true,
      });

      await expect(service.remove(2, 99)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-system role and records an audit log entry', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 5,
        name: 'Custom Role',
        isSystemRole: false,
      });
      prisma.role.delete.mockResolvedValue({ id: 5 });

      await service.remove(5, 99);

      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 99,
          action: 'delete',
          subject: 'roles',
          entityId: 5,
        }),
      );
    });

    it('throws NotFoundException when the role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });
  });
});
