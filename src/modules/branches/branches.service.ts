import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';
import { Prisma, Schedule, ShiftStatus } from '@prisma/client';
import { ShiftResponseDto } from '@modules/shifts/dto/shift-response.dto';
import { UpsertShiftDto } from '@modules/shifts/dto/upsert-shift.dto';
import { ScheduleResponseDto } from '@modules/schedule/dto/schedule-response.dto';
import { getDateInWeek } from '@common/helpers/date.helper';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createBranchDto: CreateBranchDto,
    currentUserId?: number,
  ): Promise<BranchResponseDto> {
    try {
      const branch = await this.prisma.branch.create({
        data: {
          ...createBranchDto,
          createdBy: currentUserId ?? 1,
          updatedBy: currentUserId ?? 1,
        },
      });
      return new BranchResponseDto(branch);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Branch with this name or abbreviation already exists.',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<BranchResponseDto[]> {
    const branches = await this.prisma.branch.findMany();
    return branches.map((branch) => new BranchResponseDto(branch));
  }

  async findOne(id: number): Promise<BranchResponseDto> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found.`);
    }
    return new BranchResponseDto(branch);
  }

  async update(
    id: number,
    updateBranchDto: UpdateBranchDto,
    currentUserId?: number,
  ): Promise<BranchResponseDto> {
    try {
      const branch = await this.prisma.branch.update({
        where: { id },
        data: {
          ...updateBranchDto,
          updatedBy: currentUserId ?? 1,
        },
      });
      return new BranchResponseDto(branch);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Branch with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number, currentUserId?: number): Promise<void> {
    // currentUserId available for audit/soft-delete if desired
    void currentUserId;
    try {
      await this.prisma.branch.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Branch with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async generateSchedules(
    branchId: number,
    date?: Date,
    currentUserId?: number,
  ): Promise<ScheduleResponseDto[]> {
    const targetDate = date ?? new Date();

    const shifts = await this.prisma.shift.findMany({
      where: { branchId, status: ShiftStatus.ACTIVE },
    });
    if (!shifts.length) return [];

    const days = getDateInWeek(targetDate);

    const existingSchedules = await this.prisma.schedule.findMany({
      where: {
        branchId,
        workDate: { in: days },
      },
    });
    const existingKey = new Set(
      existingSchedules.map(
        (s) => `${s.shiftId}|${new Date(s.workDate).getTime()}`,
      ),
    );
    const schedules = days.flatMap((day) =>
      shifts.map(
        (shift) =>
          ({
            branchId,
            shiftId: shift.id,
            name: shift.name,
            abbreviation: shift.abbreviation,
            maxSlots: shift.maxSlots,
            startTime: shift.startTime,
            endTime: shift.endTime,
            workDate: day,
          }) as Schedule,
      ),
    );

    const schedulesToCreate = schedules.filter(
      (s) => !existingKey.has(`${s.shiftId}|${new Date(s.workDate).getTime()}`),
    );

    await this.prisma.schedule.createMany({
      data: schedulesToCreate.map((s) => ({
        ...s,
        createdBy: currentUserId ?? 1,
        updatedBy: currentUserId ?? 1,
      })),
    });

    return schedules as ScheduleResponseDto[];
  }

  async syncShifts(
    branchId: number,
    shiftsDto: UpsertShiftDto[],
    currentUserId?: number,
  ): Promise<ShiftResponseDto[]> {
    // 1. Kiểm tra Branch có tồn tại không
    const branchExists = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branchExists) {
      throw new NotFoundException(`Branch with ID ${branchId} not found.`);
    }

    // 2. Lấy danh sách ID ca làm việc hiện tại từ database
    const existingShifts = await this.prisma.shift.findMany({
      where: { branchId },
      select: { id: true },
    });
    const existingIds = new Set(existingShifts.map((shift) => shift.id));

    // 3. Phân loại các hành động: create, update, delete
    const incomingIds = new Set(
      shiftsDto.map((shift) => shift.id).filter((id) => id !== undefined),
    );

    const toCreate = shiftsDto.filter((shift) => !shift.id);
    const toUpdate = shiftsDto.filter(
      (shift) => shift.id && existingIds.has(shift.id),
    );
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));

    try {
      await this.prisma.$transaction(async (prisma) => {
        // Xóa các ca làm việc không có trong danh sách gửi lên
        if (toDelete.length > 0) {
          await prisma.shift.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        // Tạo các ca làm việc mới
        if (toCreate.length > 0) {
          await prisma.shift.createMany({
            data: toCreate.map((shift) => ({
              ...shift,
              branchId,
              startTime: new Date(shift.startTime),
              endTime: new Date(shift.endTime),
              multiplier: new Prisma.Decimal(shift.multiplier),
              // status: shift.status,
              createdBy: currentUserId ?? 1,
              updatedBy: currentUserId ?? 1,
            })),
          });
        }

        // Cập nhật các ca làm việc đã tồn tại
        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map((shift) =>
              prisma.shift.update({
                where: { id: shift.id },
                data: {
                  ...shift,
                  startTime: new Date(shift.startTime),
                  endTime: new Date(shift.endTime),
                  multiplier: new Prisma.Decimal(shift.multiplier),
                  updatedBy: currentUserId ?? 1,
                },
              }),
            ),
          );
        }
      });

      // 4. Lấy lại tất cả các ca làm việc sau khi đã đồng bộ
      const updatedShifts = await this.prisma.shift.findMany({
        where: { branchId },
      });
      return updatedShifts.map((shift) => new ShiftResponseDto(shift));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Branch with ID ${branchId} not found.`);
      }
      throw error;
    }
  }

  async findShifts(branchId: number): Promise<ShiftResponseDto[]> {
    const shifts = await this.prisma.shift.findMany({ where: { branchId } });
    return shifts.map((branch) => new ShiftResponseDto(branch));
  }
}
