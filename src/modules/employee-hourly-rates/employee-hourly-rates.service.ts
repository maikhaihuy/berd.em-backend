import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeHourlyRateDto } from './dto/create-employee-hourly-rate.dto';
import { UpdateEmployeeHourlyRateDto } from './dto/update-employee-hourly-rate.dto';
import { EmployeeHourlyRateResponseDto } from './dto/employee-hourly-rate-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmployeeHourlyRatesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createEmployeeHourlyRateDto: CreateEmployeeHourlyRateDto,
  ): Promise<EmployeeHourlyRateResponseDto> {
    try {
      const hourlyRate = await this.prisma.employeeHourlyRate.create({
        data: {
          ...createEmployeeHourlyRateDto,
          rate: new Prisma.Decimal(createEmployeeHourlyRateDto.rate),
          createdBy: 1,
          updatedBy: 1,
        },
      });
      return new EmployeeHourlyRateResponseDto(hourlyRate);
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
    const hourlyRates = await this.prisma.employeeHourlyRate.findMany();
    return hourlyRates.map((rate) => new EmployeeHourlyRateResponseDto(rate));
  }

  async findOne(id: number): Promise<EmployeeHourlyRateResponseDto> {
    const hourlyRate = await this.prisma.employeeHourlyRate.findUnique({
      where: { id },
    });
    if (!hourlyRate) {
      throw new NotFoundException(
        `Employee hourly rate with ID ${id} not found.`,
      );
    }
    return new EmployeeHourlyRateResponseDto(hourlyRate);
  }

  async update(
    id: number,
    updateEmployeeHourlyRateDto: UpdateEmployeeHourlyRateDto,
  ): Promise<EmployeeHourlyRateResponseDto> {
    try {
      const hourlyRate = await this.prisma.employeeHourlyRate.update({
        where: { id },
        data: updateEmployeeHourlyRateDto,
      });
      return new EmployeeHourlyRateResponseDto(hourlyRate);
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

  async remove(id: number): Promise<void> {
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
