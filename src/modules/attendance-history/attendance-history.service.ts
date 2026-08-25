import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceHistoryDto } from './dto/create-attendance-history.dto';
import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceHistoryFilterDto } from './dto/attendance-history-filter.dto';
import { Prisma } from '@prisma/client';
import { attendanceHistoryInclude } from './attendance-history.types';
import { AttendanceHistoryMapper } from './attendance-history.mapper';
import { subject } from '@casl/ability';
import { AppAbility } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';

const SUBJECT = 'attendance-history';

@Injectable()
export class AttendanceHistoryService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateAttendanceHistoryDto,
    currentUserId: number,
    ability: AppAbility,
  ): Promise<AttendanceHistoryResponseDto> {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: createDto.assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${createDto.assignmentId} not found`,
      );
    }

    // The condition is shaped `{ assignment: { employeeId: <self> } }` (no
    // direct employeeId column on AttendanceHistory) — checked as an
    // instance-level access against the referenced assignment, since a
    // self-scoped caller can only record history against their own.
    if (
      !ability.can(
        'create',
        subject(SUBJECT, { assignment: { employeeId: assignment.employeeId } }),
      )
    ) {
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
    ability: AppAbility,
  ): Promise<AttendanceHistoryResponseDto[]> {
    const { assignmentId, employeeId, action, fromDate, toDate, page, limit } =
      filterDto;

    // The accessibility filter is its own top-level `AND` clause, so it
    // can't be overwritten by the `employeeId` filter below the way a
    // shared `where.assignment` key could — Prisma implicitly ANDs every
    // top-level key together with the explicit `AND` array.
    const where: Prisma.AttendanceHistoryWhereInput = {
      AND: [accessibleWhere(ability, 'read', SUBJECT)],
    };

    if (assignmentId) {
      where.assignmentId = assignmentId;
    }

    if (employeeId) {
      where.assignment = { employeeId };
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

  async findOne(
    id: number,
    ability: AppAbility,
  ): Promise<AttendanceHistoryResponseDto> {
    const history = await this.prisma.attendanceHistory.findFirst({
      where: { id, AND: [accessibleWhere(ability, 'read', SUBJECT)] },
      include: attendanceHistoryInclude,
    });

    if (!history) {
      throw new NotFoundException(`Attendance history with ID ${id} not found`);
    }

    return AttendanceHistoryMapper.toDto(history);
  }

  async findByAssignment(
    assignmentId: number,
    ability: AppAbility,
  ): Promise<AttendanceHistoryResponseDto[]> {
    const histories = await this.prisma.attendanceHistory.findMany({
      where: {
        assignmentId,
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: attendanceHistoryInclude,
    });

    return AttendanceHistoryMapper.toDtos(histories);
  }

  // Note: No update or delete methods - attendance history is immutable for audit integrity
}
