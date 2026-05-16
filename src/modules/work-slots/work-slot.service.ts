import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSlotStatus, AttendanceAction, Prisma } from '@prisma/client';
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
import { workSlotIncludeWithBranchAndEmployee } from './work-slot.types';
import { WorkSlotMapper } from './work-slot.mapper';

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
      include: workSlotIncludeWithBranchAndEmployee,
    });

    return WorkSlotMapper.toDto(workSlot);
  }

  /**
   * Find all work slots with filters and pagination
   */
  async findAll(filter: WorkSlotFilterDto): Promise<{
    data: WorkSlotResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filter);

    const [workSlots, total] = await Promise.all([
      this.prisma.workSlot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'asc' },
        include: workSlotIncludeWithBranchAndEmployee,
      }),
      this.prisma.workSlot.count({ where }),
    ]);

    return {
      data: WorkSlotMapper.toDtos(workSlots),
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
      include: workSlotIncludeWithBranchAndEmployee,
    });

    if (!workSlot) {
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    }

    return WorkSlotMapper.toDto(workSlot);
  }

  /**
   * Update a work slot
   */
  async update(
    id: number,
    dto: UpdateWorkSlotDto,
  ): Promise<WorkSlotResponseDto> {
    const existingWorkSlot = await this.findWorkSlotOrThrow(id);

    await this.validateEmployeeExists(
      dto.employeeId,
      existingWorkSlot.employeeId,
    );

    const startTime = dto.startTime
      ? new Date(dto.startTime)
      : existingWorkSlot.startTime;
    const endTime = dto.endTime
      ? new Date(dto.endTime)
      : existingWorkSlot.endTime;

    this.validateTimeRange(startTime, endTime);

    if (dto.employeeId || dto.startTime || dto.endTime) {
      await this.validateNoConflicts(
        dto.employeeId || existingWorkSlot.employeeId,
        startTime,
        endTime,
        id,
      );
    }

    const workSlot = await this.prisma.workSlot.update({
      where: { id },
      data: this.buildUpdateData(dto, startTime, endTime),
      include: workSlotIncludeWithBranchAndEmployee,
    });

    return WorkSlotMapper.toDto(workSlot);
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
    const workSlot = await this.findWorkSlotOrThrow(id);

    // Verify work slot is in SCHEDULED status
    this.validateStatus(workSlot.status, WorkSlotStatus.SCHEDULED, 'check in');

    const actualStartTime = new Date(dto.actualStartTime);

    // Update work slot with transaction to also create attendance history
    const updated = await this.updateWorkSlotWithHistory(id, {
      workSlotData: {
        actualStartTime,
        status: WorkSlotStatus.IN_PROGRESS,
        note: dto.note || workSlot.note,
        updatedBy: dto.performedBy,
      },
      historyData: {
        action: AttendanceAction.CHECK_IN,
        detail: {
          actualStartTime: actualStartTime.toISOString(),
          scheduledStartTime: workSlot.startTime.toISOString(),
          note: dto.note,
        },
        createdBy: dto.performedBy,
      },
    });

    return WorkSlotMapper.toDto(updated);
  }

  /**
   * Check-out from a work slot
   */
  async checkOut(id: number, dto: CheckOutDto): Promise<WorkSlotResponseDto> {
    const workSlot = await this.findWorkSlotOrThrow(id);

    this.validateStatus(
      workSlot.status,
      WorkSlotStatus.IN_PROGRESS,
      'check out',
    );

    if (!workSlot.actualStartTime) {
      throw new BadRequestException(
        'Cannot check out without checking in first.',
      );
    }

    const actualEndTime = new Date(dto.actualEndTime);

    if (actualEndTime <= workSlot.actualStartTime) {
      throw new BadRequestException(
        'Check-out time must be after check-in time.',
      );
    }

    const updated = await this.updateWorkSlotWithHistory(id, {
      workSlotData: {
        actualEndTime,
        status: WorkSlotStatus.COMPLETED,
        note: dto.note || workSlot.note,
        updatedBy: dto.performedBy,
      },
      historyData: {
        action: AttendanceAction.CHECK_OUT,
        detail: {
          actualEndTime: actualEndTime.toISOString(),
          scheduledEndTime: workSlot.endTime.toISOString(),
          actualStartTime: workSlot.actualStartTime.toISOString(),
          note: dto.note,
        },
        createdBy: dto.performedBy,
      },
    });

    return WorkSlotMapper.toDto(updated);
  }

  /**
   * Bulk create work slots
   */
  async bulkCreate(
    dto: BulkCreateWorkSlotDto,
  ): Promise<{ created: number; workSlots: WorkSlotResponseDto[] }> {
    await this.validateBulkEntitiesExist(dto.workSlots);
    await this.validateBulkWorkSlots(dto.workSlots);

    const createdWorkSlots = await this.prisma.$transaction(
      dto.workSlots.map((ws) =>
        this.prisma.workSlot.create({
          data: {
            branchId: ws.branchId,
            employeeId: ws.employeeId,
            assignedAt: new Date(ws.assignedAt),
            startTime: new Date(ws.startTime),
            endTime: new Date(ws.endTime),
            status: ws.status ?? WorkSlotStatus.SCHEDULED,
            note: ws.note,
            createdBy: dto.createdBy,
            updatedBy: dto.createdBy,
          },
          include: workSlotIncludeWithBranchAndEmployee,
        }),
      ),
    );

    return {
      created: createdWorkSlots.length,
      workSlots: WorkSlotMapper.toDtos(createdWorkSlots),
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
    const where: Prisma.WorkSlotWhereInput = {
      employeeId: dto.employeeId,
      // Standard interval overlap: existing.start < newEnd AND existing.end > newStart
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeWorkSlotId !== undefined && {
        id: { not: excludeWorkSlotId },
      }),
    };

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
  private buildWhereClause(
    filter: WorkSlotFilterDto,
  ): Prisma.WorkSlotWhereInput {
    return {
      ...(filter.branchId && { branchId: filter.branchId }),
      ...(filter.employeeId && { employeeId: filter.employeeId }),
      ...(filter.status && { status: filter.status }),
      ...((filter.startDate || filter.endDate) && {
        startTime: {
          ...(filter.startDate && { gte: new Date(filter.startDate) }),
          ...(filter.endDate && {
            lte: new Date(new Date(filter.endDate).setHours(23, 59, 59, 999)),
          }),
        },
      }),
    };
  }

  private async findWorkSlotOrThrow(id: number) {
    const workSlot = await this.prisma.workSlot.findUnique({ where: { id } });
    if (!workSlot)
      throw new NotFoundException(`Work slot with ID ${id} not found`);
    return workSlot;
  }

  private async validateEmployeeExists(
    newEmployeeId?: number,
    currentEmployeeId?: number,
  ) {
    if (!newEmployeeId || newEmployeeId === currentEmployeeId) return;

    const employee = await this.prisma.employee.findUnique({
      where: { id: newEmployeeId },
    });
    if (!employee)
      throw new NotFoundException(
        `Employee with ID ${newEmployeeId} not found`,
      );
  }

  private validateTimeRange(startTime: Date, endTime: Date) {
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  private async validateNoConflicts(
    employeeId: number,
    startTime: Date,
    endTime: Date,
    excludeId: number,
  ) {
    const conflict = await this.checkConflicts(
      {
        employeeId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      excludeId,
    );

    if (conflict.hasConflict) {
      throw new ConflictException(
        `Employee has conflicting work slots: ${conflict.conflictingWorkSlotIds.join(', ')}`,
      );
    }
  }

  private validateStatus(
    current: WorkSlotStatus,
    expected: WorkSlotStatus,
    action: string,
  ) {
    if (current !== expected) {
      throw new BadRequestException(
        `Work slot must be in ${expected} status to ${action}. Current status: ${current}`,
      );
    }
  }

  private buildUpdateData(
    dto: UpdateWorkSlotDto,
    startTime: Date,
    endTime: Date,
  ): Prisma.WorkSlotUpdateInput {
    return {
      ...(dto.employeeId !== undefined && {
        employee: { connect: { id: dto.employeeId } },
      }),
      ...(dto.assignedAt !== undefined && {
        assignedAt: new Date(dto.assignedAt),
      }),
      ...(dto.startTime !== undefined && { startTime }),
      ...(dto.endTime !== undefined && { endTime }),
      ...(dto.actualStartTime !== undefined && {
        actualStartTime: dto.actualStartTime
          ? new Date(dto.actualStartTime)
          : null,
      }),
      ...(dto.actualEndTime !== undefined && {
        actualEndTime: dto.actualEndTime ? new Date(dto.actualEndTime) : null,
      }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.updatedBy !== undefined && { updatedBy: dto.updatedBy }),
    };
  }

  private async updateWorkSlotWithHistory(
    id: number,
    params: {
      workSlotData: Prisma.WorkSlotUpdateInput;
      historyData: {
        action: AttendanceAction;
        detail: Record<string, string | undefined>;
        createdBy: number;
      };
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workSlot.update({
        where: { id },
        data: params.workSlotData,
        include: workSlotIncludeWithBranchAndEmployee,
      });

      await tx.attendanceHistory.create({
        data: {
          workSlotId: id,
          action: params.historyData.action,
          detail: params.historyData.detail,
          createdBy: params.historyData.createdBy,
        },
      });

      return updated;
    });
  }

  private async validateBulkEntitiesExist(
    workSlots: BulkCreateWorkSlotDto['workSlots'],
  ) {
    const branchIds = [...new Set(workSlots.map((ws) => ws.branchId))];
    const employeeIds = [...new Set(workSlots.map((ws) => ws.employeeId))];

    const [branchCount, employeeCount] = await Promise.all([
      this.prisma.branch.count({ where: { id: { in: branchIds } } }),
      this.prisma.employee.count({ where: { id: { in: employeeIds } } }),
    ]);

    if (branchCount !== branchIds.length) {
      throw new NotFoundException('One or more branches not found');
    }
    if (employeeCount !== employeeIds.length) {
      throw new NotFoundException('One or more employees not found');
    }
  }

  private async validateBulkWorkSlots(
    workSlots: BulkCreateWorkSlotDto['workSlots'],
  ) {
    // Validate time ranges trước (sync, không cần await)
    for (const ws of workSlots) {
      this.validateTimeRange(new Date(ws.startTime), new Date(ws.endTime));
    }

    // Check conflicts parallel
    const conflictResults = await Promise.all(
      workSlots.map((ws) =>
        this.checkConflicts({
          employeeId: ws.employeeId,
          startTime: ws.startTime,
          endTime: ws.endTime,
        }).then((conflict) => ({ ws, conflict })),
      ),
    );

    const conflicted = conflictResults.filter((r) => r.conflict.hasConflict);
    if (conflicted.length > 0) {
      const messages = conflicted.map(
        (r) =>
          `Employee ${r.ws.employeeId}: slots ${r.conflict.conflictingWorkSlotIds.join(', ')}`,
      );
      throw new ConflictException(
        `Conflicting work slots found:\n${messages.join('\n')}`,
      );
    }
  }
}
