import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceAction,
  AvailabilityStatus,
  Prisma,
  TaskStatus,
  TaskType,
  WorkSlotStatus,
} from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AssignmentCheckInDto } from './dto/check-in.dto';
import { AssignmentCheckOutDto } from './dto/check-out.dto';
import { assignmentInclude } from './assignment.types';
import { AssignmentMapper } from './assignment.mapper';
import { subject } from '@casl/ability';
import { AppAbility } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';

const SUBJECT = 'assignments';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssignmentDto, currentUserId: number) {
    await this.validateCreate(dto);

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.assignment.create({
          data: {
            employeeId: dto.employeeId,
            subShiftId: dto.subShiftId,
            availabilityId: dto.availabilityId,
            assignedAt: dto.assignedAt ? new Date(dto.assignedAt) : new Date(),
            status: dto.status ?? WorkSlotStatus.SCHEDULED,
            note: dto.note,
            createdBy: currentUserId,
            updatedBy: currentUserId,
          },
          include: assignmentInclude,
        });

        if (dto.availabilityId) {
          await tx.availability.update({
            where: { id: dto.availabilityId },
            data: {
              status: AvailabilityStatus.ASSIGNED,
              updatedBy: currentUserId,
            },
          });
        }

        return created;
      });

      return AssignmentMapper.toDto(assignment);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Employee is already assigned to this sub shift',
        );
      }
      throw error;
    }
  }

  async findAll(
    employeeId?: number,
    subShiftId?: number,
    ability?: AppAbility,
  ) {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(subShiftId ? { subShiftId } : {}),
        ...(ability
          ? { AND: [accessibleWhere(ability, 'read', SUBJECT)] }
          : {}),
      },
      include: assignmentInclude,
      orderBy: [{ assignedAt: 'desc' }],
    });
    return AssignmentMapper.toDtos(assignments);
  }

  async findOne(id: number, ability?: AppAbility) {
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id,
        ...(ability
          ? { AND: [accessibleWhere(ability, 'read', SUBJECT)] }
          : {}),
      },
      include: assignmentInclude,
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return AssignmentMapper.toDto(assignment);
  }

  async update(id: number, dto: UpdateAssignmentDto, currentUserId: number) {
    const existing = await this.findOne(id);
    await this.validateCreate({
      employeeId: dto.employeeId ?? existing.employeeId,
      subShiftId: dto.subShiftId ?? existing.subShiftId,
      availabilityId:
        dto.availabilityId ?? existing.availabilityId ?? undefined,
    });

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        ...dto,
        assignedAt: dto.assignedAt ? new Date(dto.assignedAt) : undefined,
        updatedBy: currentUserId,
      },
      include: assignmentInclude,
    });
    return AssignmentMapper.toDto(updated);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.assignment.delete({ where: { id } });
    return { message: 'Assignment deleted successfully' };
  }

  async checkIn(
    id: number,
    dto: AssignmentCheckInDto,
    currentUserId: number,
    ability: AppAbility,
  ) {
    const assignment = await this.findAssignmentOrThrow(
      id,
      'check-in',
      ability,
    );
    if (assignment.status !== WorkSlotStatus.SCHEDULED) {
      throw new BadRequestException(
        'Only scheduled assignments can be checked in',
      );
    }
    const actualStartTime = dto.actualStartTime
      ? new Date(dto.actualStartTime)
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.assignment.update({
        where: { id },
        data: {
          actualStartTime,
          status: WorkSlotStatus.IN_PROGRESS,
          note: dto.note ?? assignment.note,
          updatedBy: currentUserId,
        },
        include: assignmentInclude,
      });
      await tx.attendanceHistory.create({
        data: {
          assignmentId: id,
          action: AttendanceAction.CHECK_IN,
          detail: {
            actualStartTime: actualStartTime.toISOString(),
            note: dto.note,
          },
          createdBy: currentUserId,
        },
      });
      return result;
    });

    return AssignmentMapper.toDto(updated);
  }

  async checkOut(
    id: number,
    dto: AssignmentCheckOutDto,
    currentUserId: number,
    ability: AppAbility,
  ) {
    const assignment = await this.findAssignmentOrThrow(
      id,
      'check-out',
      ability,
    );
    if (
      assignment.status !== WorkSlotStatus.IN_PROGRESS &&
      assignment.status !== WorkSlotStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Only checked-in assignments can be checked out',
      );
    }
    if (!assignment.actualStartTime) {
      throw new BadRequestException('Cannot check out before checking in');
    }

    const taskGate = await this.getCheckoutTaskGate(assignment.subShiftId);
    if (taskGate.blockingTasks.length > 0) {
      throw new BadRequestException({
        message: 'Mandatory tasks must be completed before checkout',
        blockingTasks: taskGate.blockingTasks,
      });
    }

    const actualEndTime = dto.actualEndTime
      ? new Date(dto.actualEndTime)
      : new Date();
    if (actualEndTime <= assignment.actualStartTime) {
      throw new BadRequestException(
        'Checkout time must be after check-in time',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.assignment.update({
        where: { id },
        data: {
          actualEndTime,
          status: WorkSlotStatus.COMPLETED,
          note: dto.note ?? assignment.note,
          updatedBy: currentUserId,
        },
        include: assignmentInclude,
      });
      await tx.attendanceHistory.create({
        data: {
          assignmentId: id,
          action: AttendanceAction.CHECK_OUT,
          detail: {
            actualEndTime: actualEndTime.toISOString(),
            note: dto.note,
            warnings: taskGate.warnings,
          },
          createdBy: currentUserId,
        },
      });
      return result;
    });

    return {
      assignment: AssignmentMapper.toDto(updated),
      warnings: taskGate.warnings,
    };
  }

  private async validateCreate(dto: {
    employeeId: number;
    subShiftId: number;
    availabilityId?: number;
  }) {
    const [employee, subShift] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: dto.employeeId } }),
      this.prisma.subShift.findUnique({ where: { id: dto.subShiftId } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!subShift) throw new NotFoundException('Sub shift not found');
    if (!dto.availabilityId) return;

    const availability = await this.prisma.availability.findUnique({
      where: { id: dto.availabilityId },
    });
    if (!availability) throw new NotFoundException('Availability not found');
    if (
      availability.employeeId !== dto.employeeId ||
      availability.subShiftId !== dto.subShiftId
    ) {
      throw new BadRequestException(
        'Availability must belong to the same employee and sub shift',
      );
    }
  }

  private async findAssignmentOrThrow(
    id: number,
    action: string,
    ability: AppAbility,
  ) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id },
      include: { subShift: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    // check-in/check-out are self-only for every role (D6 in design.md):
    // an instance-level check against the fetched row, not a query filter,
    // since there's no list being built here.
    if (!ability.can(action, subject(SUBJECT, assignment))) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  private async getCheckoutTaskGate(subShiftId: number) {
    const subShift = await this.prisma.subShift.findUnique({
      where: { id: subShiftId },
      select: { masterShiftId: true },
    });
    if (!subShift) throw new NotFoundException('Sub shift not found');

    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          {
            masterShiftId: subShift.masterShiftId,
            type: { in: [TaskType.SHARED_MANDATORY, TaskType.SHARED_OPTIONAL] },
          },
          { subShiftId, type: TaskType.DEDICATED },
        ],
      },
      include: { completion: true },
    });

    const pending = tasks.filter(
      (task) => task.status !== TaskStatus.COMPLETED,
    );
    return {
      blockingTasks: pending
        .filter(
          (task) =>
            task.type === TaskType.SHARED_MANDATORY ||
            task.type === TaskType.DEDICATED,
        )
        .map((task) => ({ id: task.id, title: task.title, type: task.type })),
      warnings: pending
        .filter((task) => task.type === TaskType.SHARED_OPTIONAL)
        .map((task) => ({ id: task.id, title: task.title, type: task.type })),
    };
  }
}
