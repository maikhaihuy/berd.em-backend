import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftResponseDto } from './dto/shift-response.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createShiftDto: CreateShiftDto,
    currentUserId: number,
  ): Promise<ShiftResponseDto> {
    const shift = await this.prisma.shift.create({
      data: {
        ...createShiftDto,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
    });
    return new ShiftResponseDto(shift);
  }

  async findAll(): Promise<ShiftResponseDto[]> {
    const shifts = await this.prisma.shift.findMany();
    return shifts.map((shift) => new ShiftResponseDto(shift));
  }

  async findOne(id: number): Promise<ShiftResponseDto> {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
    });
    if (!shift) {
      throw new NotFoundException(`Shift with ID ${id} not found.`);
    }
    return new ShiftResponseDto(shift);
  }

  async update(
    id: number,
    updateShiftDto: UpdateShiftDto,
    currentUserId: number,
  ): Promise<ShiftResponseDto> {
    const shift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...updateShiftDto,
        updatedBy: currentUserId,
      },
    });
    return new ShiftResponseDto(shift);
  }

  async remove(id: number): Promise<void> {
    await this.prisma.shift.delete({ where: { id } });
  }
}
