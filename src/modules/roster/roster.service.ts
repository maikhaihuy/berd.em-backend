import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateRosterDto } from './dto/create-roster.dto';
import { UpdateRosterDto } from './dto/update-roster.dto';
import { RosterResponseDto } from './dto/roster-response.dto';
import { getStartAndEndInWeek } from '@common/helpers/date.helper';
import { Prisma } from '@prisma/client';

interface PrismaError extends Error {
  code?: string;
}

@Injectable()
export class RosterService {
  constructor(private prisma: PrismaService) {}

  async create(
    createRosterDto: CreateRosterDto,
    currentUserId: number,
  ): Promise<RosterResponseDto> {
    try {
      const newRoster = {
        scheduleId: createRosterDto.scheduleId,
        employeeId: createRosterDto.employeeId,
        actualStartTime: createRosterDto.actualStartTime,
        actualEndTime: createRosterDto.actualEndTime,
        note: createRosterDto.note,
        assignedAt: createRosterDto.assignedAt,
        status: createRosterDto.status,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      };

      const roster = await this.prisma.roster.create({
        data: newRoster,
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
    } catch (error) {
      const prismaError = error as PrismaError;
      if (prismaError.code === 'P2002') {
        throw new BadRequestException('Schedule conflict detected');
      }
      if (prismaError.code === 'P2003') {
        throw new BadRequestException('Invalid reference data');
      }
      throw error;
    }
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

    try {
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
    } catch (error) {
      const prismaError = error as PrismaError;
      if (prismaError.code === 'P2002') {
        throw new BadRequestException('Schedule conflict detected');
      }
      if (prismaError.code === 'P2003') {
        throw new BadRequestException('Invalid reference data');
      }
      throw error;
    }
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
}
