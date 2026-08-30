import { Injectable, NotFoundException } from '@nestjs/common';
import { FieldValidationException } from '@common/exceptions/field-validation.exception';
import { uniqueConstraintFields } from '@common/helpers/prisma-errors.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { Prisma, UserStatus } from '@prisma/client';
import { UpsertEmployeeHourlyRateDto } from '@modules/employee-hourly-rates/dto/upsert-employee-hourly-rate.dto';
import { EmployeeHourlyRateResponseDto } from '@modules/employee-hourly-rates/dto/employee-hourly-rate-response.dto';
import { EmployeeMapper } from './employee.mapper';
import {
  employeeWithBranchesInclude,
  employeeWithUserInclude,
} from './employee.types';
import { EmployeeHourlyRatesMapper } from '@modules/employee-hourly-rates/employee-hourly-rates.mapper';
import type { AppAbility } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { PasswordService } from '@common/services/password.service';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';

const SUBJECT = 'employees';
const EMPLOYEE_ROLE_NAME = 'Employee';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(
    createEmployeeDto: CreateEmployeeDto,
    currentUserId: number,
  ): Promise<EmployeeResponseDto> {
    const { branchIds, primaryBranchId, ...employeeData } = createEmployeeDto;

    // Verify branches if provided
    if (branchIds && branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: branchIds } },
      });
      if (branches.length !== branchIds.length) {
        throw new FieldValidationException(
          'branchIds',
          'One or more branches do not exist',
        );
      }

      // Validate primaryBranchId is in branchIds if provided
      if (primaryBranchId && !branchIds.includes(primaryBranchId)) {
        throw new FieldValidationException(
          'primaryBranchId',
          'Primary branch must be in the list of assigned branches',
        );
      }
    }

    // Check if phone number already exists
    const existingPhone = await this.prisma.employee.findUnique({
      where: { phoneNumber: employeeData.phoneNumber },
    });
    if (existingPhone) {
      throw new FieldValidationException(
        'phoneNumber',
        'Employee with this phone number already exists',
      );
    }

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        // A pre-existing User with this phone number is not silently reused
        // or overwritten — reject loudly and let the Admin resolve it
        // manually.
        const existingUser = await tx.user.findUnique({
          where: { phoneNumber: employeeData.phoneNumber },
        });
        if (existingUser) {
          throw new FieldValidationException(
            'phoneNumber',
            'A user account with this phone number already exists',
          );
        }

        const employeeRole = await tx.role.findFirstOrThrow({
          where: { name: EMPLOYEE_ROLE_NAME },
        });

        const hashedPassword = await this.passwordService.hash(
          employeeData.phoneNumber,
        );

        const user = await tx.user.create({
          data: {
            phoneNumber: employeeData.phoneNumber,
            fullName: employeeData.fullName,
            password: hashedPassword,
            status: UserStatus.ACTIVE,
            mustChangePassword: true,
            userRoles: {
              create: [{ roleId: employeeRole.id }],
            },
          },
        });

        await this.auditLogsService.record(
          {
            actorId: currentUserId,
            action: 'create',
            subject: 'users',
            entityId: user.id,
            after: {
              phoneNumber: user.phoneNumber,
              fullName: user.fullName,
              status: user.status,
              mustChangePassword: user.mustChangePassword,
            },
          },
          tx,
        );

        return tx.employee.create({
          data: {
            ...employeeData,
            userId: user.id,
            createdBy: currentUserId,
            updatedBy: currentUserId,
            employeeBranches:
              branchIds && branchIds.length > 0
                ? {
                    create: branchIds.map((branchId) => ({
                      branchId,
                      isPrimary: branchId === primaryBranchId,
                    })),
                  }
                : undefined,
          },
          include: {
            ...employeeWithBranchesInclude,
          },
        });
      });

      return EmployeeMapper.toDtoWithBranches(employee);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new FieldValidationException(
            uniqueConstraintFields(error),
            'Email or phone already in use.',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('One or more branches not found.');
        }
      }
      throw error;
    }
  }

  async findAll(ability: AppAbility): Promise<EmployeeResponseDto[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: {
        ...employeeWithBranchesInclude,
        ...employeeWithUserInclude,
      },
    });
    return EmployeeMapper.toDtos(employees, {
      withBranches: true,
      withUser: true,
    });
  }

  async findOne(id: number, ability: AppAbility): Promise<EmployeeResponseDto> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: {
        ...employeeWithBranchesInclude,
        ...employeeWithUserInclude,
      },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }
    return EmployeeMapper.toDto(employee, {
      withBranches: true,
      withUser: true,
    });
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    currentUserId: number,
  ): Promise<EmployeeResponseDto> {
    const { branchIds, ...employeeData } = updateEmployeeDto;

    // Verify employee exists
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!existingEmployee) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // If updating phone number, check it's not already taken
    if (
      employeeData.phoneNumber &&
      employeeData.phoneNumber !== existingEmployee.phoneNumber
    ) {
      const phoneExists = await this.prisma.employee.findUnique({
        where: { phoneNumber: updateEmployeeDto.phoneNumber },
      });
      if (phoneExists) {
        throw new FieldValidationException(
          'phoneNumber',
          'Phone number already in use',
        );
      }
    }

    try {
      const employee = await this.prisma.employee.update({
        where: { id },
        data: {
          ...employeeData,
          updatedBy: currentUserId,
          employeeBranches: branchIds
            ? {
                deleteMany: {}, // Remove existing relations
                create: branchIds.map((branchId) => ({
                  branchId,
                  isPrimary: false, // You can add logic to set primary branch if needed
                })),
              }
            : undefined,
        },
        include: {
          ...employeeWithBranchesInclude,
        },
      });

      return EmployeeMapper.toDtoWithBranches(employee);
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
      return updatedRates.map((rate) =>
        EmployeeHourlyRatesMapper.mapBase(rate),
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
