import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateRosterDto } from './dto/create-roster.dto';
import { UpdateRosterDto } from './dto/update-roster.dto';
import { RosterResponseDto } from './dto/roster-response.dto';
import { getStartAndEndInWeek } from '@common/helpers/date.helper';
import { Prisma, RosterStatus, RosterMode } from '@prisma/client';

@Injectable()
export class RosterService {
  constructor(private prisma: PrismaService) {}

  async create(
    createRosterDto: CreateRosterDto,
    currentUserId: number,
  ): Promise<RosterResponseDto> {
    // Determine mode/status based on whether the current user is the same employee
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    const isSelfRequest =
      currentUser?.employeeId != null &&
      currentUser.employeeId === createRosterDto.employeeId;

    const mode = isSelfRequest ? RosterMode.REQUEST : RosterMode.ASSIGNED;
    const status = isSelfRequest
      ? RosterStatus.PENDING
      : RosterStatus.SCHEDULED;

    const roster = await this.prisma.roster.create({
      data: {
        ...createRosterDto,
        mode,
        status,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: {
        schedule: {
          include: {
            shift: true,
            branch: true,
          },
        },
        employee: true,
      },
    });

    return roster as RosterResponseDto;
  }

  async findAll(
    branchId?: number,
    date?: string,
  ): Promise<RosterResponseDto[]> {
    const where: Prisma.RosterWhereInput = {};

    // If branchId is provided, filter by branch through schedule
    if (branchId) {
      where.schedule = {
        branchId: branchId,
      };
    }

    // If date is provided, calculate week range and filter by schedule workDate
    if (date) {
      const targetDate = new Date(date);
      const { start, end } = getStartAndEndInWeek(targetDate);

      where.schedule = {
        is: {
          workDate: {
            gte: start,
            lte: end,
          },
        },
      };
    }

    const rosters = await this.prisma.roster.findMany({
      where,
      include: {
        schedule: {
          include: {
            shift: true,
            branch: true,
          },
        },
        employee: true,
      },
      orderBy: [
        { schedule: { workDate: 'asc' } },
        { schedule: { startTime: 'asc' } },
      ],
    });

    return rosters as RosterResponseDto[];
  }

  async findOne(id: number): Promise<RosterResponseDto> {
    const roster = await this.prisma.roster.findUnique({
      where: { id },
      include: {
        schedule: {
          include: {
            shift: true,
            branch: true,
          },
        },
        employee: true,
      },
    });

    if (!roster) {
      throw new NotFoundException(`Roster with ID ${id} not found`);
    }

    return roster as RosterResponseDto;
  }

  async update(
    id: number,
    updateRosterDto: UpdateRosterDto,
    currentUserId: number,
  ): Promise<RosterResponseDto> {
    // Check if roster exists
    const existingRoster = await this.prisma.roster.findUnique({
      where: { id },
    });

    if (!existingRoster) {
      throw new NotFoundException(`Roster with ID ${id} not found`);
    }

    const roster = await this.prisma.roster.update({
      where: { id },
      data: {
        ...updateRosterDto,
        updatedBy: currentUserId,
      },
      include: {
        schedule: {
          include: {
            shift: true,
            branch: true,
          },
        },
        employee: true,
      },
    });

    return roster as RosterResponseDto;
  }

  async remove(id: number): Promise<void> {
    // Check if roster exists
    const existingRoster = await this.prisma.roster.findUnique({
      where: { id },
    });

    if (!existingRoster) {
      throw new NotFoundException(`Roster with ID ${id} not found`);
    }

    await this.prisma.roster.delete({
      where: { id },
    });
  }

  async schedule(
    id: number,
    currentUserId: number,
  ): Promise<RosterResponseDto> {
    const roster = await this.prisma.roster.update({
      where: { id },
      data: { status: RosterStatus.SCHEDULED, updatedBy: currentUserId },
      include: {
        schedule: {
          include: { shift: true, branch: true },
        },
        employee: true,
      },
    });

    return roster as RosterResponseDto;
  }

  async unschedule(
    id: number,
    currentUserId: number,
  ): Promise<RosterResponseDto> {
    const roster = await this.prisma.roster.update({
      where: { id },
      data: { status: RosterStatus.PENDING, updatedBy: currentUserId },
      include: {
        schedule: {
          include: { shift: true, branch: true },
        },
        employee: true,
      },
    });

    return roster as RosterResponseDto;
  }
}
