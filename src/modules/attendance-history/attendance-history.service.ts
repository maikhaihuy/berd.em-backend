import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceHistoryDto } from './dto/create-attendance-history.dto';
import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceHistoryFilterDto } from './dto/attendance-history-filter.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttendanceHistoryService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateAttendanceHistoryDto,
    currentUserId: number,
  ): Promise<AttendanceHistoryResponseDto> {
    // Verify work slot exists
    const workSlot = await this.prisma.workSlot.findUnique({
      where: { id: createDto.workSlotId },
    });

    if (!workSlot) {
      throw new NotFoundException(
        `Work slot with ID ${createDto.workSlotId} not found`,
      );
    }

    const attendanceHistory = await this.prisma.attendanceHistory.create({
      data: {
        workSlotId: createDto.workSlotId,
        action: createDto.action,
        detail: createDto.detail || Prisma.JsonNull,
        createdBy: currentUserId,
      },
    });

    return new AttendanceHistoryResponseDto(attendanceHistory);
  }

  async findAll(
    filterDto: AttendanceHistoryFilterDto,
  ): Promise<AttendanceHistoryResponseDto[]> {
    const { workSlotId, employeeId, action, fromDate, toDate, page, limit } =
      filterDto;

    const where: Prisma.AttendanceHistoryWhereInput = {};

    if (workSlotId) {
      where.workSlotId = workSlotId;
    }

    if (employeeId) {
      where.workSlot = {
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
      include: {
        workSlot: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return histories.map(
      (history) => new AttendanceHistoryResponseDto(history),
    );
  }

  async findOne(id: number): Promise<AttendanceHistoryResponseDto> {
    const history = await this.prisma.attendanceHistory.findUnique({
      where: { id },
      include: {
        workSlot: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!history) {
      throw new NotFoundException(`Attendance history with ID ${id} not found`);
    }

    return new AttendanceHistoryResponseDto(history);
  }

  async findByWorkSlot(
    workSlotId: number,
  ): Promise<AttendanceHistoryResponseDto[]> {
    const histories = await this.prisma.attendanceHistory.findMany({
      where: { workSlotId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return histories.map(
      (history) => new AttendanceHistoryResponseDto(history),
    );
  }

  // Note: No update or delete methods - attendance history is immutable for audit integrity
}
