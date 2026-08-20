import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceHistoryDto } from './dto/create-attendance-history.dto';
import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceHistoryFilterDto } from './dto/attendance-history-filter.dto';
import { Prisma } from '@prisma/client';
import { attendanceHistoryInclude } from './attendance-history.types';
import { AttendanceHistoryMapper } from './attendance-history.mapper';

@Injectable()
export class AttendanceHistoryService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateAttendanceHistoryDto,
    currentUserId: number,
  ): Promise<AttendanceHistoryResponseDto> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: createDto.assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${createDto.assignmentId} not found`,
      );
    }

    const attendanceHistory = await this.prisma.attendanceHistory.create({
      data: {
        assignmentId: createDto.assignmentId,
        action: createDto.action,
        detail: createDto.detail || Prisma.JsonNull,
        createdBy: currentUserId,
      },
      include: attendanceHistoryInclude,
    });

    return AttendanceHistoryMapper.toDto(attendanceHistory);
  }

  async findAll(
    filterDto: AttendanceHistoryFilterDto,
  ): Promise<AttendanceHistoryResponseDto[]> {
    const { assignmentId, employeeId, action, fromDate, toDate, page, limit } =
      filterDto;

    const where: Prisma.AttendanceHistoryWhereInput = {};

    if (assignmentId) {
      where.assignmentId = assignmentId;
    }

    if (employeeId) {
      where.assignment = {
        employeeId,
      };
    }

    if (action) {
      where.action = action;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    const skip = page && limit ? (page - 1) * limit : undefined;
    const take = limit;

    const histories = await this.prisma.attendanceHistory.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: attendanceHistoryInclude,
    });

    return AttendanceHistoryMapper.toDtos(histories);
  }

  async findOne(id: number): Promise<AttendanceHistoryResponseDto> {
    const history = await this.prisma.attendanceHistory.findUnique({
      where: { id },
      include: attendanceHistoryInclude,
    });

    if (!history) {
      throw new NotFoundException(`Attendance history with ID ${id} not found`);
    }

    return AttendanceHistoryMapper.toDto(history);
  }

  async findByAssignment(
    assignmentId: number,
  ): Promise<AttendanceHistoryResponseDto[]> {
    const histories = await this.prisma.attendanceHistory.findMany({
      where: { assignmentId },
      orderBy: {
        createdAt: 'desc',
      },
      include: attendanceHistoryInclude,
    });

    return AttendanceHistoryMapper.toDtos(histories);
  }

  // Note: No update or delete methods - attendance history is immutable for audit integrity
}
