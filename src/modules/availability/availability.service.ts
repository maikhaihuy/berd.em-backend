import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { Prisma } from '@prisma/client';
import { AvailabilityMapper } from './availability.mapper';
import { availabilityWithEmployeeInclude } from './availability.types';
import { userWithEmployeeInclude } from '@modules/users/user.types';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCurrentUserEmployee(currentUserId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: userWithEmployeeInclude,
    });

    if (!user?.employee) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    return user.employee;
  }

  async create(
    createAvailabilityDto: CreateAvailabilityDto,
    currentUserId: number,
  ): Promise<AvailabilityResponseDto> {
    const employee = await this.getCurrentUserEmployee(currentUserId);

    if (createAvailabilityDto.employeeId !== employee.id) {
      throw new ForbiddenException(
        'Employees can only create availability for themselves',
      );
    }

    const availabilitiesExist = await this.prisma.availability.findMany({
      where: {
        employeeId: createAvailabilityDto.employeeId,
        startTime: {
          lt: new Date(createAvailabilityDto.endTime),
        },
        endTime: {
          gt: new Date(createAvailabilityDto.startTime),
        },
      },
    });
    if (availabilitiesExist.length > 0) {
      throw new BadRequestException(
        'Availability for this time slot already exists',
      );
    }

    try {
      const availability = await this.prisma.availability.create({
        data: {
          employeeId: createAvailabilityDto.employeeId,
          startTime: new Date(createAvailabilityDto.startTime),
          endTime: new Date(createAvailabilityDto.endTime),
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: availabilityWithEmployeeInclude,
      });

      return AvailabilityMapper.toDto(availability);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Availability for this time slot already exists',
          );
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Employee not found');
        }
      }
      throw error;
    }
  }

  async findAll(
    from: Date,
    to: Date,
    currentUserId: number,
  ): Promise<AvailabilityResponseDto[]> {
    const employee = await this.getCurrentUserEmployee(currentUserId);

    const availabilities = await this.prisma.availability.findMany({
      where: {
        startTime: {
          gte: from,
        },
        endTime: {
          lte: to,
        },
        employeeId: employee.id,
      },
      include: availabilityWithEmployeeInclude,
      orderBy: {
        startTime: 'asc',
      },
    });

    return AvailabilityMapper.toDtos(availabilities);
  }

  async findOne(
    id: number,
    currentUserId: number,
  ): Promise<AvailabilityResponseDto> {
    const employee = await this.getCurrentUserEmployee(currentUserId);

    const availability = await this.prisma.availability.findUnique({
      where: { id, employeeId: employee.id },
      include: availabilityWithEmployeeInclude,
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    // Employees can only see their own availability
    // if (userRole !== 'manager' && userRole !== 'admin') {
    //   const user = await this.prisma.user.findUnique({
    //     where: { id: userId },
    //     select: { employeeId: true },
    //   });

    //   if (!user?.employeeId || user.employeeId !== availability.employeeId) {
    //     throw new ForbiddenException('Access denied');
    //   }
    // }

    return AvailabilityMapper.toDto(availability);
  }

  async update(
    id: number,
    updateAvailabilityDto: UpdateAvailabilityDto,
    currentUserId: number,
  ): Promise<AvailabilityResponseDto> {
    const availability = await this.prisma.availability.findUnique({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    const employee = await this.getCurrentUserEmployee(currentUserId);

    if (availability.employeeId !== employee.id) {
      throw new ForbiddenException(
        'Employees can only create availability for themselves',
      );
    }

    try {
      const updatedAvailability = await this.prisma.availability.update({
        where: { id },
        data: {
          ...updateAvailabilityDto,
          startTime: new Date(updateAvailabilityDto.startTime),
          endTime: new Date(updateAvailabilityDto.endTime),
        },
        include: availabilityWithEmployeeInclude,
      });

      return AvailabilityMapper.toDto(updatedAvailability);
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Availability for this time slot already exists',
          );
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Employee not found');
        }
      }
      throw error;
    }
  }

  async remove(
    id: number,
    currentUserId: number,
  ): Promise<{ message: string }> {
    const availability = await this.prisma.availability.findUnique({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    await this.getCurrentUserEmployee(currentUserId);

    await this.prisma.availability.delete({
      where: { id },
    });

    return { message: 'Availability deleted successfully' };
  }
}
