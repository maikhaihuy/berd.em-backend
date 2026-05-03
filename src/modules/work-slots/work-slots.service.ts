import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSlotStatus, AttendanceAction } from '@prisma/client';
import { CreateWorkSlotDto } from './dto/create-work-slot.dto';
import { UpdateWorkSlotDto } from './dto/update-work-slot.dto';
import { WorkSlotResponseDto } from './dto/work-slot-response.dto';
import { BulkCreateWorkSlotDto } from './dto/bulk-create-work-slot.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { WorkSlotFilterDto } from './dto/work-slot-filter.dto';
import {
  ConflictCheckDto,
  ConflictResponseDto,
} from './dto/conflict-check.dto';

@Injectable()
export class WorkSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a single work slot
   */
  async create(dto: CreateWorkSlotDto): Promise<WorkSlotResponseDto> {
    // Verify branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${dto.branchId} not found`);
    }

    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${dto.employeeId} not found`,
      );
    }

    // Validate time range
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for conflicts
    const conflict = await this.checkConflicts({
      employeeId: dto.employeeId,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    if (conflict.hasConflict) {
      throw new ConflictException(
        `Employee has conflicting work slots: ${conflict.conflictingWorkSlotIds.join(', ')}`,
      );
    }

    // Create work slot
    const workSlot = await this.prisma.workSlot.create({
      data: {
        branchId: dto.branchId,
        employeeId: dto.employeeId,
        assignedAt: new Date(dto.assignedAt),
        startTime: startTime,
        endTime: endTime,
        status: dto.status || WorkSlotStatus.SCHEDULED,
        note: dto.note,
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      },
      include: {
        branch: {
          select: { name: true, abbreviation: true },
        },
        employee: {
          select: { fullName: true, phoneNumber: true },
        },
      },
    });

    return this.mapToResponseDto(workSlot);
  }

  /**
   * Find all work slots with filters and pagination
   */
  async findAll(
    filter: WorkSlotFilterDto,
  ): Promise<{ data: WorkSlotResponseDto[]; total: number; page: number; limit: number }> {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filter.branchId) {
      where.branchId = filter.branchId;
    }

    if (filter.employeeId) {
      where.employeeId = filter.employeeId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.startTime = {};
      if (filter.startDate) {
        where.startTime.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        const endDate = new Date(filter.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.startTime.lte = endDate;
      }
    }

    // Execute queries
    const [workSlots, total] = await Promise.all([
      this.prisma.workSlot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'asc' },
        include: {
          branch: {
            select: { name: true, abbreviation: true },
          },
          employee: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      }),
      this.prisma.workSlot.count({ where }),
    ]);

    return {
      data: workSlots.map((ws) => this.mapToResponseDto(ws)),
      total,
      page,
      limit,
    };
  }

  /**
   * Find a single work slot by ID
   */
  async findOne(id: number): Promise<WorkSlotResponseDto> {
    const workSlot = await this.prisma.workSlot.findUnique({
      where: { id },
      include: {
        branch: {
          select: { name: true, abbreviation: true },
        },
        employee: {
          select: { fullName: true, phoneNumber: true },
        },
      },
    });

    if (!workSlot) {
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    }

    return this.mapToResponseDto(workSlot);
  }

  /**
   * Update a work slot
   */
  async update(
    id: number,
    dto: UpdateWorkSlotDto,
  ): Promise<WorkSlotResponseDto> {
    // Verify work slot exists
    const existingWorkSlot = await this.prisma.workSlot.findUnique({
      where: { id },
    });

    if (!existingWorkSlot) {
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    }

    // Verify branch if changed
    if (dto.branchId && dto.branchId !== existingWorkSlot.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID ${dto.branchId} not found`);
      }
    }

    // Verify employee if changed
    if (dto.employeeId && dto.employeeId !== existingWorkSlot.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
      });
      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${dto.employeeId} not found`,
        );
      }
    }

    // Validate time range if times are being updated
    const startTime = dto.startTime
      ? new Date(dto.startTime)
      : existingWorkSlot.startTime;
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : existingWorkSlot.endTime;

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for conflicts if employee or times changed
    if (dto.employeeId || dto.startTime || dto.endTime) {
      const conflict = await this.checkConflicts(
        {
          employeeId: dto.employeeId || existingWorkSlot.employeeId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        id,
      );

      if (conflict.hasConflict) {
        throw new ConflictException(
          `Employee has conflicting work slots: ${conflict.conflictingWorkSlotIds.join(', ')}`,
        );
      }
    }

    // Build update data
    const updateData: any = {};

    if (dto.branchId !== undefined) updateData.branchId = dto.branchId;
    if (dto.employeeId !== undefined) updateData.employeeId = dto.employeeId;
    if (dto.assignedAt !== undefined)
      updateData.assignedAt = new Date(dto.assignedAt);
    if (dto.startTime !== undefined) updateData.startTime = startTime;
    if (dto.endTime !== undefined) updateData.endTime = endTime;
    if (dto.actualStartTime !== undefined)
      updateData.actualStartTime = dto.actualStartTime
        ? new Date(dto.actualStartTime)
        : null;
    if (dto.actualEndTime !== undefined)
      updateData.actualEndTime = dto.actualEndTime
        ? new Date(dto.actualEndTime)
        : null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.note !== undefined) updateData.note = dto.note;
    if (dto.updatedBy !== undefined) updateData.updatedBy = dto.updatedBy;

    // Update work slot
    const workSlot = await this.prisma.workSlot.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: { name: true, abbreviation: true },
        },
        employee: {
          select: { fullName: true, phoneNumber: true },
        },
      },
    });

    return this.mapToResponseDto(workSlot);
  }

  /**
   * Delete a work slot
   */
  async remove(id: number): Promise<{ message: string }> {
    const workSlot = await this.prisma.workSlot.findUnique({
      where: { id },
    });

    if (!workSlot) {
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    }

    // Check if work slot is in progress or completed
    if (
      workSlot.status === WorkSlotStatus.IN_PROGRESS ||
      workSlot.status === WorkSlotStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Cannot delete work slot that is in progress or completed',
      );
    }

    await this.prisma.workSlot.delete({
      where: { id },
    });

    return { message: `Work slot with ID ${id} deleted successfully` };
  }

  /**
   * Check-in to a work slot
   */
  async checkIn(id: number, dto: CheckInDto): Promise<WorkSlotResponseDto> {
    const workSlot = await this.prisma.workSlot.findUnique({
      where: { id },
    });

    if (!workSlot) {
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    }

    // Verify work slot is in SCHEDULED status
    if (workSlot.status !== WorkSlotStatus.SCHEDULED) {
      throw new BadRequestException(
        `Work slot must be in SCHEDULED status to check in. Current status: ${workSlot.status}`,
      );
    }

    const actualStartTime = new Date(dto.actualStartTime);

    // Update work slot with transaction to also create attendance history
    const updatedWorkSlot = await this.prisma.$transaction(async (tx) => {
      // Update work slot
      const updated = await tx.workSlot.update({
        where: { id },
        data: {
          actualStartTime,
          status: WorkSlotStatus.IN_PROGRESS,
          note: dto.note || workSlot.note,
          updatedBy: dto.performedBy,
        },
        include: {
          branch: {
            select: { name: true, abbreviation: true },
          },
          employee: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      });

      // Create attendance history
      await tx.attendanceHistory.create({
        data: {
          workSlotId: id,
          action: AttendanceAction.CHECK_IN,
          detail: {
            actualStartTime: actualStartTime.toISOString(),
            scheduledStartTime: workSlot.startTime.toISOString(),
            note: dto.note,
          },
          createdBy: dto.performedBy,
        },
      });

      return updated;
    });

    return this.mapToResponseDto(updatedWorkSlot);
  }

  /**
   * Check-out from a work slot
   */
  async checkOut(id: number, dto: CheckOutDto): Promise<WorkSlotResponseDto> {
    const workSlot = await this.prisma.workSlot.findUnique({
      where: { id },
    });

    if (!workSlot) {
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    }

    // Verify work slot is in IN_PROGRESS status
    if (workSlot.status !== WorkSlotStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Work slot must be in IN_PROGRESS status to check out. Current status: ${workSlot.status}`,
      );
    }

    // Verify actualStartTime exists
    if (!workSlot.actualStartTime) {
      throw new BadRequestException(
        'Work slot has no check-in time. Cannot check out without checking in first.',
      );
    }

    const actualEndTime = new Date(dto.actualEndTime);

    // Validate that end time is after start time
    if (actualEndTime <= workSlot.actualStartTime) {
      throw new BadRequestException(
        'Check-out time must be after check-in time',
      );
    }

    // Update work slot with transaction to also create attendance history
    const updatedWorkSlot = await this.prisma.$transaction(async (tx) => {
      // Update work slot
      const updated = await tx.workSlot.update({
        where: { id },
        data: {
          actualEndTime,
          status: WorkSlotStatus.COMPLETED,
          note: dto.note || workSlot.note,
          updatedBy: dto.performedBy,
        },
        include: {
          branch: {
            select: { name: true, abbreviation: true },
          },
          employee: {
            select: { fullName: true, phoneNumber: true },
          },
        },
      });

      // Create attendance history
      await tx.attendanceHistory.create({
        data: {
          workSlotId: id,
          action: AttendanceAction.CHECK_OUT,
          detail: {
            actualEndTime: actualEndTime.toISOString(),
            scheduledEndTime: workSlot.endTime.toISOString(),
            actualStartTime: workSlot.actualStartTime!.toISOString(),
            note: dto.note,
          },
          createdBy: dto.performedBy,
        },
      });

      return updated;
    });

    return this.mapToResponseDto(updatedWorkSlot);
  }

  /**
   * Bulk create work slots
   */
  async bulkCreate(
    dto: BulkCreateWorkSlotDto,
  ): Promise<{ created: number; workSlots: WorkSlotResponseDto[] }> {
    // Validate all work slots
    const branchIds = [...new Set(dto.workSlots.map((ws) => ws.branchId))];
    const employeeIds = [...new Set(dto.workSlots.map((ws) => ws.employeeId))];

    // Verify all branches exist
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
    });
    if (branches.length !== branchIds.length) {
      throw new NotFoundException('One or more branches not found');
    }

    // Verify all employees exist
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
    });
    if (employees.length !== employeeIds.length) {
      throw new NotFoundException('One or more employees not found');
    }

    // Validate time ranges for all work slots
    for (const ws of dto.workSlots) {
      const startTime = new Date(ws.startTime);
      const endTime = new Date(ws.endTime);
      if (startTime >= endTime) {
        throw new BadRequestException(
          `Invalid time range for employee ${ws.employeeId}: start time must be before end time`,
        );
      }
    }

    // Check for conflicts for each work slot
    for (const ws of dto.workSlots) {
      const conflict = await this.checkConflicts({
        employeeId: ws.employeeId,
        startTime: ws.startTime,
        endTime: ws.endTime,
      });

      if (conflict.hasConflict) {
        throw new ConflictException(
          `Employee ${ws.employeeId} has conflicting work slots: ${conflict.conflictingWorkSlotIds.join(', ')}`,
        );
      }
    }

    // Create all work slots in a transaction
    const createdWorkSlots = await this.prisma.$transaction(
      dto.workSlots.map((ws) =>
        this.prisma.workSlot.create({
          data: {
            branchId: ws.branchId,
            employeeId: ws.employeeId,
            assignedAt: new Date(ws.assignedAt),
            startTime: new Date(ws.startTime),
            endTime: new Date(ws.endTime),
            status: ws.status || WorkSlotStatus.SCHEDULED,
            note: ws.note,
            createdBy: dto.createdBy,
            updatedBy: dto.createdBy,
          },
          include: {
            branch: {
              select: { name: true, abbreviation: true },
            },
            employee: {
              select: { fullName: true, phoneNumber: true },
            },
          },
        }),
      ),
    );

    return {
      created: createdWorkSlots.length,
      workSlots: createdWorkSlots.map((ws) => this.mapToResponseDto(ws)),
    };
  }

  /**
   * Check for scheduling conflicts for an employee
   */
  async checkConflicts(
    dto: ConflictCheckDto,
    excludeWorkSlotId?: number,
  ): Promise<ConflictResponseDto> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    // Find overlapping work slots for the employee
    const where: any = {
      employeeId: dto.employeeId,
      OR: [
        {
          // New slot starts during existing slot
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } },
          ],
        },
        {
          // New slot ends during existing slot
          AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }],
        },
        {
          // New slot completely contains existing slot
          AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }],
        },
      ],
    };

    // Exclude specific work slot if updating
    if (excludeWorkSlotId !== undefined) {
      where.id = { not: excludeWorkSlotId };
    }

    const conflicts = await this.prisma.workSlot.findMany({
      where,
      select: { id: true },
    });

    return {
      hasConflict: conflicts.length > 0,
      conflictingWorkSlotIds: conflicts.map((c) => c.id),
      message:
        conflicts.length > 0
          ? `Found ${conflicts.length} conflicting work slot(s)`
          : 'No conflicts found',
    };
  }

  /**
   * Map Prisma work slot to response DTO
   */
  private mapToResponseDto(workSlot: any): WorkSlotResponseDto {
    return {
      id: workSlot.id,
      branchId: workSlot.branchId,
      employeeId: workSlot.employeeId,
      assignedAt: workSlot.assignedAt,
      startTime: workSlot.startTime,
      endTime: workSlot.endTime,
      actualStartTime: workSlot.actualStartTime,
      actualEndTime: workSlot.actualEndTime,
      status: workSlot.status,
      note: workSlot.note,
      branchName: workSlot.branch?.name,
      branchAbbreviation: workSlot.branch?.abbreviation,
      employeeFullName: workSlot.employee?.fullName,
      employeePhoneNumber: workSlot.employee?.phoneNumber,
      createdAt: workSlot.createdAt,
      createdBy: workSlot.createdBy,
      updatedAt: workSlot.updatedAt,
      updatedBy: workSlot.updatedBy,
    };
  }
}
