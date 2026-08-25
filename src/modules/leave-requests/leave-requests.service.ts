import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveRequestDto } from './dto/approve-leave-request.dto';
import { LeaveRequestResponseDto } from './dto/leave-request-response.dto';
import { LeaveStatus, Prisma } from '@prisma/client';
import { leaveRequestWithRelationsInclude } from './leave-request.types';
import { LeaveRequestMapper } from './leave-request.mapper';
import { subject } from '@casl/ability';
import { AppAbility } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';

const SUBJECT = 'leave-requests';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateLeaveRequestDto,
    currentUserId: number,
    ability: AppAbility,
    callerEmployeeId?: number,
  ): Promise<LeaveRequestResponseDto> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: createDto.assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${createDto.assignmentId} not found`,
      );
    }

    // A self-scoped grant's condition can't be enforced via accessibleBy on
    // a create payload, so it's checked directly against the candidate
    // absenceEmployeeId: if the caller's ability wouldn't let them file a
    // leave request for that employee, fall back to their own (guaranteed
    // resolvable — the guard already resolved every condition on this
    // caller's abilities). An unscoped grant's `can()` always passes, so a
    // Manager filing on another employee's behalf is unaffected.
    let absenceEmployeeId = createDto.absenceEmployeeId;
    if (
      callerEmployeeId !== undefined &&
      !ability.can('create', subject(SUBJECT, { absenceEmployeeId }))
    ) {
      absenceEmployeeId = callerEmployeeId;
    }

    // Verify absence employee exists
    const absenceEmployee = await this.prisma.employee.findUnique({
      where: { id: absenceEmployeeId },
    });

    if (!absenceEmployee) {
      throw new NotFoundException(
        `Employee with ID ${absenceEmployeeId} not found`,
      );
    }

    // Verify replacement employee exists
    const replacementEmployee = await this.prisma.employee.findUnique({
      where: { id: createDto.replacementEmployeeId },
    });

    if (!replacementEmployee) {
      throw new NotFoundException(
        `Employee with ID ${createDto.replacementEmployeeId} not found`,
      );
    }

    // Check if absence and replacement are different
    if (absenceEmployeeId === createDto.replacementEmployeeId) {
      throw new BadRequestException(
        'Absence employee and replacement employee must be different',
      );
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        assignmentId: createDto.assignmentId,
        absenceEmployeeId,
        replacementEmployeeId: createDto.replacementEmployeeId,
        reason: createDto.reason,
        note: createDto.note,
        status: createDto.status || LeaveStatus.PENDING,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: leaveRequestWithRelationsInclude,
    });

    return LeaveRequestMapper.toDto(leaveRequest);
  }

  async findAll(ability: AppAbility): Promise<LeaveRequestResponseDto[]> {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: { AND: [accessibleWhere(ability, 'read', SUBJECT)] },
      include: leaveRequestWithRelationsInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return LeaveRequestMapper.toDtos(leaveRequests);
  }

  async findOne(
    id: number,
    ability: AppAbility,
  ): Promise<LeaveRequestResponseDto> {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, AND: [accessibleWhere(ability, 'read', SUBJECT)] },
      include: leaveRequestWithRelationsInclude,
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    return LeaveRequestMapper.toDto(leaveRequest);
  }

  async findByEmployee(
    employeeId: number,
    ability: AppAbility,
  ): Promise<LeaveRequestResponseDto[]> {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        OR: [
          { absenceEmployeeId: employeeId },
          { replacementEmployeeId: employeeId },
        ],
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: leaveRequestWithRelationsInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return LeaveRequestMapper.toDtos(leaveRequests);
  }

  async findByStatus(
    status: LeaveStatus,
    ability: AppAbility,
  ): Promise<LeaveRequestResponseDto[]> {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: { status, AND: [accessibleWhere(ability, 'read', SUBJECT)] },
      include: leaveRequestWithRelationsInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return LeaveRequestMapper.toDtos(leaveRequests);
  }

  async update(
    id: number,
    updateDto: UpdateLeaveRequestDto,
    currentUserId: number,
  ): Promise<LeaveRequestResponseDto> {
    // Verify leave request exists
    const existingRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    // Only allow updates if status is PENDING
    if (existingRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Can only update leave requests with PENDING status',
      );
    }

    // If updating replacement employee, verify they exist
    if (updateDto.replacementEmployeeId) {
      const replacementEmployee = await this.prisma.employee.findUnique({
        where: { id: updateDto.replacementEmployeeId },
      });

      if (!replacementEmployee) {
        throw new NotFoundException(
          `Employee with ID ${updateDto.replacementEmployeeId} not found`,
        );
      }

      // Check if new replacement is different from absence employee
      if (
        updateDto.replacementEmployeeId === existingRequest.absenceEmployeeId
      ) {
        throw new BadRequestException(
          'Replacement employee cannot be the same as absence employee',
        );
      }
    }

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...updateDto,
        updatedBy: currentUserId,
      },
      include: leaveRequestWithRelationsInclude,
    });

    return LeaveRequestMapper.toDto(leaveRequest);
  }

  async approve(
    id: number,
    approveDto: ApproveLeaveRequestDto,
    currentUserId: number,
  ): Promise<LeaveRequestResponseDto> {
    // Verify leave request exists
    const existingRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    // Only allow approval/rejection if status is PENDING
    if (existingRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Can only approve/reject leave requests with PENDING status',
      );
    }

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: approveDto.status,
        approvedId: currentUserId,
        approvedAt: new Date(),
        note: approveDto.note || existingRequest.note,
        updatedBy: currentUserId,
      },
      include: leaveRequestWithRelationsInclude,
    });

    return LeaveRequestMapper.toDto(leaveRequest);
  }

  async cancel(
    id: number,
    currentUserId: number,
    ability: AppAbility,
  ): Promise<LeaveRequestResponseDto> {
    // Verify leave request exists (and, for a self-scoped caller, that it's theirs)
    const existingRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, AND: [accessibleWhere(ability, 'cancel', SUBJECT)] },
    });

    if (!existingRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    // Only allow cancellation if not already approved or rejected
    if (
      existingRequest.status === LeaveStatus.APPROVED ||
      existingRequest.status === LeaveStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Cannot cancel approved or rejected leave requests',
      );
    }

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.CANCELLED,
        updatedBy: currentUserId,
      },
      include: leaveRequestWithRelationsInclude,
    });

    return LeaveRequestMapper.toDto(leaveRequest);
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.leaveRequest.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Leave request with ID ${id} not found`);
      }
      throw error;
    }
  }
}
