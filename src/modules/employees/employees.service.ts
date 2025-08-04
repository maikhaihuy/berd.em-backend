import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Employee, Prisma } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.EmployeeCreateInput): Promise<Employee> {
    return this.prisma.employee.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.employee.findMany({
      where: { isActive: true },
      include: {
        branches: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        branches: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        hourlyRates: {
          where: {
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
          orderBy: { effectiveDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async update(id: number, data: Prisma.EmployeeUpdateInput) {
    const employee = await this.findOne(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.employee.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const employee = await this.findOne(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Soft delete by setting isActive to false
    return this.prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
