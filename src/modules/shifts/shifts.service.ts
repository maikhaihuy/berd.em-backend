import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftResponseDto } from './dto/shift-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async create(createShiftDto: CreateShiftDto): Promise<ShiftResponseDto> {
    try {
      const shift = await this.prisma.shift.create({
        data: {
          ...createShiftDto,
          createdBy: 1,
          updatedBy: 1,
        },
      });
      return new ShiftResponseDto(shift);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Branch with ID ${createShiftDto.branchId} not found.`,
        );
      }
      throw error;
    }
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
  ): Promise<ShiftResponseDto> {
    try {
      const shift = await this.prisma.shift.update({
        where: { id },
        data: updateShiftDto,
      });
      return new ShiftResponseDto(shift);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Shift with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.shift.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Shift with ID ${id} not found.`);
      }
      throw error;
    }
  }
}
