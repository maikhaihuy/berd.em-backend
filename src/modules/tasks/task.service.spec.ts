/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus, TaskType } from '@prisma/client';
import { TasksService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TasksService', () => {
  let prisma: Partial<PrismaService>;
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      subShift: { findUnique: jest.fn() } as any,
      masterShift: { findUnique: jest.fn() } as any,
      user: { findUnique: jest.fn() } as any,
      assignment: { findFirst: jest.fn() } as any,
      $transaction: jest.fn((callback: (prism: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    service = new TasksService(prisma as PrismaService);
  });

  describe('create', () => {
    it('creates a dedicated task once its sub shift is validated', async () => {
      (prisma.subShift as any).findUnique.mockResolvedValue({ id: 2 });
      (prisma.task as any).create.mockResolvedValue({
        id: 10,
        taskTemplateId: null,
        masterShiftId: null,
        subShiftId: 2,
        title: 'Clean counter',
        description: null,
        type: TaskType.DEDICATED,
        status: TaskStatus.PENDING,
        sortOrder: 0,
        dueAt: null,
        note: null,
        taskTemplate: null,
        masterShift: null,
        subShift: { id: 2, title: 'Morning', masterShiftId: 1 },
        completion: null,
        createdAt: new Date(),
        createdBy: 99,
        updatedAt: new Date(),
        updatedBy: 99,
      });

      const result = await service.create(
        {
          subShiftId: 2,
          title: 'Clean counter',
          type: TaskType.DEDICATED,
        } as any,
        99,
      );

      expect(result.id).toBe(10);
      expect((prisma.task as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subShiftId: 2,
            type: TaskType.DEDICATED,
            createdBy: 99,
            updatedBy: 99,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the task does not exist', async () => {
      (prisma.task as any).findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('re-validates scope against the merged dto before updating', async () => {
      (prisma.task as any).findUnique.mockResolvedValue({
        id: 10,
        taskTemplateId: null,
        masterShiftId: 1,
        subShiftId: null,
        title: 'Open shop',
        description: null,
        type: TaskType.SHARED_MANDATORY,
        status: TaskStatus.PENDING,
        sortOrder: 0,
        dueAt: null,
        note: null,
        taskTemplate: null,
        masterShift: { id: 1, title: 'Morning', workDate: new Date() },
        subShift: null,
        completion: null,
        createdAt: new Date(),
        createdBy: 99,
        updatedAt: new Date(),
        updatedBy: 99,
      });
      (prisma.masterShift as any).findUnique.mockResolvedValue({ id: 1 });
      (prisma.task as any).update.mockResolvedValue({
        id: 10,
        taskTemplateId: null,
        masterShiftId: 1,
        subShiftId: null,
        title: 'Open shop (updated)',
        description: null,
        type: TaskType.SHARED_MANDATORY,
        status: TaskStatus.PENDING,
        sortOrder: 0,
        dueAt: null,
        note: null,
        taskTemplate: null,
        masterShift: { id: 1, title: 'Morning', workDate: new Date() },
        subShift: null,
        completion: null,
        createdAt: new Date(),
        createdBy: 99,
        updatedAt: new Date(),
        updatedBy: 99,
      });

      const result = await service.update(
        10,
        { title: 'Open shop (updated)' } as any,
        99,
      );

      expect(result.title).toBe('Open shop (updated)');
      expect((prisma.masterShift as any).findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('complete', () => {
    it('marks the task completed and upserts a TaskCompletion for an assigned employee', async () => {
      (prisma.task as any).findUnique.mockResolvedValue({
        id: 10,
        taskTemplateId: null,
        masterShiftId: null,
        subShiftId: 2,
        title: 'Clean counter',
        description: null,
        type: TaskType.DEDICATED,
        status: TaskStatus.PENDING,
        sortOrder: 0,
        dueAt: null,
        note: null,
        taskTemplate: null,
        masterShift: null,
        subShift: { id: 2, title: 'Morning', masterShiftId: 1 },
        completion: null,
        createdAt: new Date(),
        createdBy: 99,
        updatedAt: new Date(),
        updatedBy: 99,
      });
      (prisma.assignment as any).findFirst.mockResolvedValue({ id: 5 });
      (prisma.task as any).update.mockResolvedValue({});
      const completedAt = new Date();
      (prisma.taskCompletion as any) = { upsert: jest.fn() };
      (prisma.taskCompletion as any).upsert.mockResolvedValue({
        id: 1,
        taskId: 10,
        completedByEmployeeId: 7,
        task: { id: 10 },
        completedByEmployee: { id: 7 },
        completedAt,
        evidence: null,
        note: null,
        createdAt: completedAt,
        createdBy: 99,
        updatedAt: completedAt,
        updatedBy: 99,
      });

      const result = await service.complete(
        10,
        { completedByEmployeeId: 7 },
        99,
      );

      expect(result.completedByEmployeeId).toBe(7);
      expect((prisma.task as any).update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: TaskStatus.COMPLETED, updatedBy: 99 },
      });
    });

    it('rejects completion by an employee not assigned to the sub shift', async () => {
      (prisma.task as any).findUnique.mockResolvedValue({
        id: 10,
        taskTemplateId: null,
        masterShiftId: null,
        subShiftId: 2,
        title: 'Clean counter',
        description: null,
        type: TaskType.DEDICATED,
        status: TaskStatus.PENDING,
        sortOrder: 0,
        dueAt: null,
        note: null,
        taskTemplate: null,
        masterShift: null,
        subShift: { id: 2, title: 'Morning', masterShiftId: 1 },
        completion: null,
        createdAt: new Date(),
        createdBy: 99,
        updatedAt: new Date(),
        updatedBy: 99,
      });
      (prisma.assignment as any).findFirst.mockResolvedValue(null);

      await expect(
        service.complete(10, { completedByEmployeeId: 7 }, 99),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes the task after confirming it exists', async () => {
      (prisma.task as any).findUnique.mockResolvedValue({
        id: 10,
        taskTemplateId: null,
        masterShiftId: null,
        subShiftId: 2,
        title: 'Clean counter',
        description: null,
        type: TaskType.DEDICATED,
        status: TaskStatus.PENDING,
        sortOrder: 0,
        dueAt: null,
        note: null,
        taskTemplate: null,
        masterShift: null,
        subShift: { id: 2, title: 'Morning', masterShiftId: 1 },
        completion: null,
        createdAt: new Date(),
        createdBy: 99,
        updatedAt: new Date(),
        updatedBy: 99,
      });

      const result = await service.remove(10);

      expect(result).toEqual({ message: 'Task deleted successfully' });
      expect((prisma.task as any).delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });
    });
  });
});
