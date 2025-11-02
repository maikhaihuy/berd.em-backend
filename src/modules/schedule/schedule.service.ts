import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { RosterStatus, ScheduleStatus } from '@prisma/client';
import { SchduleWithRostersResponseDto } from './dto/schedule-with-rosters-response.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createScheduleDto: CreateScheduleDto,
    currentUserId: number,
  ): Promise<ScheduleResponseDto> {
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

    const schedule = await this.prisma.schedule.create({
      data: {
        shiftId: createScheduleDto.shiftId,
        branchId: createScheduleDto.branchId,
        name: shift.name,
        abbreviation: shift.abbreviation,
        maxSlots: shift.maxSlots,
        workDate: new Date(createScheduleDto.workDate),
        startTime: new Date(createScheduleDto.startTime),
        endTime: new Date(createScheduleDto.endTime),
        status: createScheduleDto.status,
        note: createScheduleDto.note,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: {},
    });

    return new ScheduleResponseDto(schedule);
  }

  async findAll(
    currentUserId: number,
    branchId: number,
    start: Date,
    end: Date,
  ): Promise<ScheduleResponseDto[]> {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        startTime: {
          gte: start,
        },
        endTime: {
          lte: end,
        },
        branchId,
      },
      include: {},
      orderBy: {
        startTime: 'asc',
      },
    });

    return schedules.map((schedule) => new ScheduleResponseDto(schedule));
  }

  async findOne(id: number): Promise<ScheduleResponseDto> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {},
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
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

    const updateData: Record<string, any> = {
      updatedBy: currentUserId,
    };

    if (updateScheduleDto.startTime) {
      updateData.startTime = new Date(updateScheduleDto.startTime);
    }

    if (updateScheduleDto.endTime) {
      updateData.endTime = new Date(updateScheduleDto.endTime);
    }

    if (updateScheduleDto.workDate) {
      updateData.workDate = new Date(updateScheduleDto.workDate);
    }

    if (updateScheduleDto.status !== undefined) {
      updateData.status = updateScheduleDto.status;
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
      // also update denormalized fields from shift
      updateData.name = shift.name;
      updateData.abbreviation = shift.abbreviation;
      updateData.maxSlots = shift.maxSlots;
    }

    const updatedSchedule = await this.prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {},
    });

    return new ScheduleResponseDto(updatedSchedule);
  }

  async remove(id: number): Promise<{ message: string }> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // No employee ownership on Schedule after schema change

    await this.prisma.schedule.delete({
      where: { id },
    });

    return { message: 'Schedule deleted successfully' };
  }

  private async updatePublishState(
    id: number,
    currentUserId: number,
    publish: boolean,
  ): Promise<SchduleWithRostersResponseDto> {
    const targetScheduleStatus = publish
      ? ScheduleStatus.PUBLISHED
      : ScheduleStatus.DRAFT;
    const fromRosterStatus = publish
      ? RosterStatus.PENDING
      : RosterStatus.REJECTED;
    const toRosterStatus = publish
      ? RosterStatus.REJECTED
      : RosterStatus.PENDING;

    const updatedSchedule = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.schedule.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Schedule not found');
      }

      const schedule = await tx.schedule.update({
        where: { id },
        data: {
          status: targetScheduleStatus,
          updatedBy: currentUserId,
        },
        include: {
          rosters: true, // becareful
        },
      });

      await tx.roster.updateMany({
        where: { scheduleId: id, status: fromRosterStatus },
        data: { status: toRosterStatus, updatedBy: currentUserId },
      });

      return schedule;
    });

    return new SchduleWithRostersResponseDto(updatedSchedule);
  }

  async publish(
    id: number,
    currentUserId: number,
  ): Promise<SchduleWithRostersResponseDto> {
    return this.updatePublishState(id, currentUserId, true);
  }

  async unpublish(
    id: number,
    currentUserId: number,
  ): Promise<SchduleWithRostersResponseDto> {
    return this.updatePublishState(id, currentUserId, false);
  }
}
