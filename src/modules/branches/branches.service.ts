import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';
import { Prisma } from '@prisma/client';
import { ShiftResponseDto } from '@modules/shifts/dto/shift-response.dto';
import { UpsertShiftDto } from '@modules/shifts/dto/upsert-shift.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(createBranchDto: CreateBranchDto): Promise<BranchResponseDto> {
    try {
      const branch = await this.prisma.branch.create({
        data: {
          ...createBranchDto,
          createdBy: 1,
          updatedBy: 1,
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
  ): Promise<BranchResponseDto> {
    try {
      const branch = await this.prisma.branch.update({
        where: { id },
        data: updateBranchDto,
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

  async remove(id: number): Promise<void> {
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

  async syncShifts(
    branchId: number,
    shiftsDto: UpsertShiftDto[],
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
              createdBy: 1, // Placeholder
              updatedBy: 1, // Placeholder
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
                  updatedBy: 1, // Placeholder
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
}
