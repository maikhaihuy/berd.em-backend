import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { Prisma } from '@prisma/client';
import { UpsertEmployeeHourlyRateDto } from '@modules/employee-hourly-rates/dto/upsert-employee-hourly-rate.dto';
import { EmployeeHourlyRateResponseDto } from '@modules/employee-hourly-rates/dto/employee-hourly-rate-response.dto';
import { EmployeeMapper } from './employee.mapper';
import { employeeWithBranchesInclude } from './employee.types';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createEmployeeDto: CreateEmployeeDto,
    currentUserId?: number,
  ): Promise<EmployeeResponseDto> {
    const { branchIds, ...rest } = createEmployeeDto;

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        // Create employee first
        const {
          dateOfBirth,
          probationStartDate,
          officialStartDate,
          ...otherFields
        } = rest;
        const employeeData: Prisma.EmployeeCreateInput = {
          ...otherFields,
          createdBy: currentUserId ?? 1,
          updatedBy: currentUserId ?? 1,
        };

        // Convert date strings to Date objects if provided
        if (dateOfBirth) {
          employeeData.dateOfBirth = new Date(dateOfBirth);
        }
        if (probationStartDate) {
          employeeData.probationStartDate = new Date(probationStartDate);
        }
        if (officialStartDate) {
          employeeData.officialStartDate = new Date(officialStartDate);
        }

        const newEmployee = await tx.employee.create({
          data: employeeData,
        });

        // Create EmployeeBranch relationships with isPrimary field
        if (branchIds && branchIds.length > 0) {
          for (let i = 0; i < branchIds.length; i++) {
            await tx.employeeBranch.create({
              data: {
                employeeId: newEmployee.id,
                branchId: branchIds[i],
                isPrimary: i === 0, // First branch is primary
              },
            });
          }
        }

        // Return employee with relationships
        const employeeWithRelations = await tx.employee.findUnique({
          where: { id: newEmployee.id },
          include: {
            hourlyRates: true,
            branches: {
              include: {
                branch: true,
              },
            },
          },
        });

        if (!employeeWithRelations) {
          throw new NotFoundException('Failed to create employee');
        }

        return employeeWithRelations;
      });

      return EmployeeMapper.toDto(employee);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Email or phone already in use.');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('One or more branches not found.');
        }
      }
      throw error;
    }
  }

  async findAll(): Promise<EmployeeResponseDto[]> {
    const employees = await this.prisma.employee.findMany({
      include: employeeWithBranchesInclude,
    });
    return EmployeeMapper.toDtos(employees);
  }

  async findOne(id: number): Promise<EmployeeResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }
    return EmployeeMapper.toDto(employee);
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    currentUserId?: number,
  ): Promise<EmployeeResponseDto> {
    const { branchIds, ...rest } = updateEmployeeDto;

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        // Update employee basic info
        const {
          dateOfBirth,
          probationStartDate,
          officialStartDate,
          ...otherFields
        } = rest;
        const updateData: Prisma.EmployeeUpdateInput = {
          ...otherFields,
          updatedBy: currentUserId ?? 1,
        };

        // Convert date strings to Date objects if provided
        if (dateOfBirth) {
          updateData.dateOfBirth = new Date(dateOfBirth);
        }
        if (probationStartDate) {
          updateData.probationStartDate = new Date(probationStartDate);
        }
        if (officialStartDate) {
          updateData.officialStartDate = new Date(officialStartDate);
        }

        await tx.employee.update({
          where: { id },
          data: updateData,
        });

        // Update EmployeeBranch relationships if branchIds provided
        if (branchIds !== undefined) {
          // Delete existing relationships
          await tx.employeeBranch.deleteMany({
            where: { employeeId: id },
          });

          // Create new relationships
          if (branchIds.length > 0) {
            for (let i = 0; i < branchIds.length; i++) {
              await tx.employeeBranch.create({
                data: {
                  employeeId: id,
                  branchId: branchIds[i],
                  isPrimary: i === 0, // First branch is primary
                },
              });
            }
          }
        }

        // Return updated employee with relationships
        const updatedEmployee = await tx.employee.findUnique({
          where: { id },
          include: {
            branches: {
              include: {
                branch: true,
              },
            },
          },
        });

        if (!updatedEmployee) {
          throw new NotFoundException(`Employee with ID ${id} not found.`);
        }

        return updatedEmployee;
      });

      return EmployeeMapper.toDto(employee);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Employee with ID ${id} or a related branch not found.`,
        );
      }
      throw error;
    }
  }

  async remove(id: number, currentUserId?: number): Promise<void> {
    try {
      // currentUserId available for audit if needed (soft-delete)
      void currentUserId;
      await this.prisma.employee.delete({ where: { id } }); // TODO: xóa bao gồm luôn Employee hourly rate records
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Employee with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async syncHourlyRates(
    employeeId: number,
    ratesDto: UpsertEmployeeHourlyRateDto[],
    currentUserId?: number,
  ): Promise<EmployeeHourlyRateResponseDto[]> {
    // 1. Kiểm tra Employee có tồn tại không
    const employeeExists = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employeeExists) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found.`);
    }

    // 2. Lấy danh sách ID hiện tại từ database
    const existingRates = await this.prisma.employeeHourlyRate.findMany({
      where: { employeeId },
      select: { id: true },
    });
    const existingIds = new Set(existingRates.map((rate) => rate.id));

    // 3. Phân loại các hành động: create, update, delete
    const incomingIds = new Set(
      ratesDto.map((rate) => rate.id).filter((id) => id !== undefined),
    );

    const toCreate = ratesDto.filter((rate) => !rate.id);
    const toUpdate = ratesDto.filter(
      (rate) => rate.id && existingIds.has(rate.id),
    );
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));

    try {
      await this.prisma.$transaction(async (prisma) => {
        // Xóa các bản ghi không có trong danh sách gửi lên
        if (toDelete.length > 0) {
          await prisma.employeeHourlyRate.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        // Tạo các bản ghi mới
        if (toCreate.length > 0) {
          await prisma.employeeHourlyRate.createMany({
            data: toCreate.map((rate) => ({
              ...rate,
              employeeId,
              rate: new Prisma.Decimal(rate.rate),
              createdBy: currentUserId ?? 1,
              updatedBy: currentUserId ?? 1,
            })),
          });
        }

        // Cập nhật các bản ghi đã tồn tại
        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map((rate) =>
              prisma.employeeHourlyRate.update({
                where: { id: rate.id },
                data: {
                  ...rate,
                  rate: new Prisma.Decimal(rate.rate),
                  updatedBy: currentUserId ?? 1,
                },
              }),
            ),
          );
        }
      });

      // 4. Lấy lại tất cả các bản ghi sau khi đã đồng bộ
      const updatedRates = await this.prisma.employeeHourlyRate.findMany({
        where: { employeeId },
      });
      return updatedRates.map(
        (rate) => new EmployeeHourlyRateResponseDto(rate),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Employee with ID ${employeeId} not found.`,
        );
      }
      throw error;
    }
  }
}
