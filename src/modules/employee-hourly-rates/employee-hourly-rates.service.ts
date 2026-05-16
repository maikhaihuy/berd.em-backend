import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeHourlyRateDto } from './dto/create-employee-hourly-rate.dto';
import { UpdateEmployeeHourlyRateDto } from './dto/update-employee-hourly-rate.dto';
import { EmployeeHourlyRateResponseDto } from './dto/employee-hourly-rate-response.dto';
import { Prisma } from '@prisma/client';
import { EmployeeHourlyRatesMapper } from './employee-hourly-rates.mapper';
import { employeeHourlyRateWithEmployeeInclude } from './employee-hourly-rates.types';

@Injectable()
export class EmployeeHourlyRatesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createEmployeeHourlyRateDto: CreateEmployeeHourlyRateDto,
    currentUserId: number,
  ): Promise<EmployeeHourlyRateResponseDto> {
    try {
      const hourlyRate = await this.prisma.employeeHourlyRate.create({
        data: {
          ...createEmployeeHourlyRateDto,
          rate: new Prisma.Decimal(createEmployeeHourlyRateDto.rate),
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: employeeHourlyRateWithEmployeeInclude,
      });
      return EmployeeHourlyRatesMapper.toDto(hourlyRate);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Employee with ID ${createEmployeeHourlyRateDto.employeeId} not found.`,
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<EmployeeHourlyRateResponseDto[]> {
    const hourlyRates = await this.prisma.employeeHourlyRate.findMany({
      include: employeeHourlyRateWithEmployeeInclude,
    });
    return EmployeeHourlyRatesMapper.toDtos(hourlyRates);
  }

  async findOne(id: number): Promise<EmployeeHourlyRateResponseDto> {
    const hourlyRate = await this.prisma.employeeHourlyRate.findUnique({
      where: { id },
      include: employeeHourlyRateWithEmployeeInclude,
    });
    if (!hourlyRate) {
      throw new NotFoundException(
        `Employee hourly rate with ID ${id} not found.`,
      );
    }
    return EmployeeHourlyRatesMapper.toDto(hourlyRate);
  }

  async update(
    id: number,
    updateEmployeeHourlyRateDto: UpdateEmployeeHourlyRateDto,
    currentUserId: number,
  ): Promise<EmployeeHourlyRateResponseDto> {
    try {
      const hourlyRate = await this.prisma.employeeHourlyRate.update({
        where: { id },
        data: {
          ...updateEmployeeHourlyRateDto,
          updatedBy: currentUserId,
        },
        include: employeeHourlyRateWithEmployeeInclude,
      });
      return EmployeeHourlyRatesMapper.toDto(hourlyRate);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Employee hourly rate with ID ${id} not found.`,
        );
      }
      throw error;
    }
  }

  async remove(id: number, currentUserId?: number): Promise<void> {
    // currentUserId available for audit/soft-delete if desired
    void currentUserId;
    try {
      await this.prisma.employeeHourlyRate.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Employee hourly rate with ID ${id} not found.`,
        );
      }
      throw error;
    }
  }
}
