/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
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
    roleId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: { id: 1, name: 'Employee' },
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      role: { findUnique: jest.fn() } as any,
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
      (prisma.role as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.user as any).create.mockResolvedValue(baseUser);

      await service.create(
        {
          phoneNumber: baseUser.phoneNumber,
          fullName: baseUser.fullName,
          roleId: baseUser.roleId,
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
            roleId: baseUser.roleId,
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
});
