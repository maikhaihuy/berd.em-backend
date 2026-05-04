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

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateLeaveRequestDto,
    currentUserId: number,
  ): Promise<LeaveRequestResponseDto> {
    // Verify work slot exists
    const workSlot = await this.prisma.workSlot.findUnique({
      where: { id: createDto.workSlotId },
    });

    if (!workSlot) {
      throw new NotFoundException(
        `Work slot with ID ${createDto.workSlotId} not found`,
      );
    }

    // Verify absence employee exists
    const absenceEmployee = await this.prisma.employee.findUnique({
      where: { id: createDto.absenceEmployeeId },
    });

    if (!absenceEmployee) {
      throw new NotFoundException(
        `Employee with ID ${createDto.absenceEmployeeId} not found`,
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
    if (createDto.absenceEmployeeId === createDto.replacementEmployeeId) {
      throw new BadRequestException(
        'Absence employee and replacement employee must be different',
      );
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        workSlotId: createDto.workSlotId,
        absenceEmployeeId: createDto.absenceEmployeeId,
        replacementEmployeeId: createDto.replacementEmployeeId,
        reason: createDto.reason,
        note: createDto.note,
        status: createDto.status || LeaveStatus.PENDING,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
    });

    return new LeaveRequestResponseDto(leaveRequest);
  }

  async findAll(): Promise<LeaveRequestResponseDto[]> {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        workSlot: {
          include: {
            employee: {
              select: { id: true, fullName: true },
            },
            branch: {
              select: { id: true, name: true },
            },
          },
        },
        absenceEmployee: {
          select: { id: true, fullName: true },
        },
        replacementEmployee: {
          select: { id: true, fullName: true },
        },
      },
    });

    return leaveRequests.map((request) => new LeaveRequestResponseDto(request));
  }

  async findOne(id: number): Promise<LeaveRequestResponseDto> {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        workSlot: {
          include: {
            employee: {
              select: { id: true, fullName: true },
            },
            branch: {
              select: { id: true, name: true },
            },
          },
        },
        absenceEmployee: {
          select: { id: true, fullName: true },
        },
        replacementEmployee: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    return new LeaveRequestResponseDto(leaveRequest);
  }

  async findByEmployee(employeeId: number): Promise<LeaveRequestResponseDto[]> {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        OR: [
          { absenceEmployeeId: employeeId },
          { replacementEmployeeId: employeeId },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return leaveRequests.map((request) => new LeaveRequestResponseDto(request));
  }

  async findByStatus(status: LeaveStatus): Promise<LeaveRequestResponseDto[]> {
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: { status },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return leaveRequests.map((request) => new LeaveRequestResponseDto(request));
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
    });

    return new LeaveRequestResponseDto(leaveRequest);
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
    });

    return new LeaveRequestResponseDto(leaveRequest);
  }

  async cancel(
    id: number,
    currentUserId: number,
  ): Promise<LeaveRequestResponseDto> {
    // Verify leave request exists
    const existingRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
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
    });

    return new LeaveRequestResponseDto(leaveRequest);
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
