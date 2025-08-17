import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';

interface PrismaError extends Error {
  code?: string;
}

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createScheduleDto: CreateScheduleDto,
    currentUserId: number,
  ): Promise<ScheduleResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    if (createScheduleDto.employeeId !== user.employeeId) {
      throw new ForbiddenException(
        'Employees can only create schedules for themselves',
      );
    }

    // Validate that shift and branch exist and are compatible
    const shift = await this.prisma.shift.findUnique({
      where: { id: createScheduleDto.shiftId },
      include: { branch: true },
    });

    if (!shift) {
      throw new BadRequestException('Shift not found');
    }

    if (shift.branchId !== createScheduleDto.branchId) {
      throw new BadRequestException(
        'Shift does not belong to the specified branch',
      );
    }

    // Validate employee exists and works at the branch
    const employee = await this.prisma.employee.findUnique({
      where: { id: createScheduleDto.employeeId },
      include: {
        branches: {
          where: { branchId: createScheduleDto.branchId },
        },
      },
    });

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    if (employee.branches.length === 0) {
      throw new BadRequestException(
        'Employee does not work at the specified branch',
      );
    }

    try {
      const schedule = await this.prisma.schedule.create({
        data: {
          shiftId: createScheduleDto.shiftId,
          employeeId: createScheduleDto.employeeId,
          branchId: createScheduleDto.branchId,
          startTime: new Date(createScheduleDto.startTime),
          endTime: new Date(createScheduleDto.endTime),
          note: createScheduleDto.note,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: {
          shift: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
          employee: {
            select: {
              fullName: true,
            },
          },
          branch: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
        },
      });

      return new ScheduleResponseDto(schedule);
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
    currentUserId: number,
    branchId: number,
    start: Date,
    end: Date,
  ): Promise<ScheduleResponseDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    const schedules = await this.prisma.schedule.findMany({
      where: {
        startTime: {
          gte: start,
        },
        endTime: {
          lte: end,
        },
        branchId,
        employeeId: user.employeeId,
      },
      include: {
        shift: {
          select: {
            name: true,
            abbreviation: true,
          },
        },
        employee: {
          select: {
            fullName: true,
          },
        },
        branch: {
          select: {
            name: true,
            abbreviation: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return schedules.map((schedule) => new ScheduleResponseDto(schedule));
  }

  async findOne(id: number, userId: number): Promise<ScheduleResponseDto> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        shift: {
          select: {
            name: true,
            abbreviation: true,
          },
        },
        employee: {
          select: {
            fullName: true,
          },
        },
        branch: {
          select: {
            name: true,
            abbreviation: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    if (!user?.employeeId || user.employeeId !== schedule.employeeId) {
      throw new ForbiddenException('Access denied');
    }

    return new ScheduleResponseDto(schedule);
  }

  async update(
    id: number,
    updateScheduleDto: UpdateScheduleDto,
    currentUserId: number,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId || user.employeeId !== schedule.employeeId) {
      throw new ForbiddenException('Access denied');
    }

    const updateData: Record<string, any> = {
      updatedBy: currentUserId,
    };

    if (updateScheduleDto.startTime) {
      updateData.startTime = new Date(updateScheduleDto.startTime);
    }

    if (updateScheduleDto.endTime) {
      updateData.endTime = new Date(updateScheduleDto.endTime);
    }

    if (updateScheduleDto.note !== undefined) {
      updateData.note = updateScheduleDto.note;
    }

    // Validate shift and branch compatibility if being updated
    if (updateScheduleDto.shiftId || updateScheduleDto.branchId) {
      const shiftId = updateScheduleDto.shiftId || schedule.shiftId;
      const branchId = updateScheduleDto.branchId || schedule.branchId;

      const shift = await this.prisma.shift.findUnique({
        where: { id: shiftId },
      });

      if (!shift) {
        throw new BadRequestException('Shift not found');
      }

      if (shift.branchId !== branchId) {
        throw new BadRequestException(
          'Shift does not belong to the specified branch',
        );
      }

      updateData.shiftId = shiftId;
      updateData.branchId = branchId;
    }

    try {
      const updatedSchedule = await this.prisma.schedule.update({
        where: { id },
        data: updateData,
        include: {
          shift: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
          employee: {
            select: {
              fullName: true,
            },
          },
          branch: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
        },
      });

      return new ScheduleResponseDto(updatedSchedule);
    } catch (error) {
      const prismaError = error as PrismaError;
      if (prismaError.code === 'P2002') {
        throw new BadRequestException('Schedule conflict detected');
      }
      throw error;
    }
  }

  async remove(
    id: number,
    currentUserId: number,
  ): Promise<{ message: string }> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId || user.employeeId !== schedule.employeeId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.schedule.delete({
      where: { id },
    });

    return { message: 'Schedule deleted successfully' };
  }
}
