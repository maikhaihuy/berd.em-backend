import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftMapper } from './shift.mapper';
import { ShiftDto } from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createShiftDto: CreateShiftDto,
    currentUserId: number,
  ): Promise<ShiftDto> {
    // Verify branch exists
    const existingBranch = await this.prisma.branch.findUnique({
      where: { id: createShiftDto.branchId },
    });
    if (!existingBranch) {
      throw new NotFoundException(
        `Branch with ID ${createShiftDto.branchId} not found.`,
      );
    }

    const shift = await this.prisma.shift.create({
      data: {
        ...createShiftDto,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
    });
    return ShiftMapper.toShiftDto(shift);
  }

  async findAll(): Promise<ShiftDto[]> {
    const shifts = await this.prisma.shift.findMany();
    return ShiftMapper.toDtos(shifts);
  }

  async findOne(id: number): Promise<ShiftDto> {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
    });
    if (!shift) {
      throw new NotFoundException(`Shift with ID ${id} not found.`);
    }
    return ShiftMapper.toShiftDto(shift);
  }

  async update(
    id: number,
    updateShiftDto: UpdateShiftDto,
    currentUserId: number,
  ): Promise<ShiftDto> {
    const shift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...updateShiftDto,
        updatedBy: currentUserId,
      },
    });
    return ShiftMapper.toShiftDto(shift);
  }

  async remove(id: number): Promise<void> {
    await this.prisma.shift.delete({ where: { id } });
  }
}
