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

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createAvailabilityDto: CreateAvailabilityDto,
    currentUserId: number,
  ): Promise<AvailabilityResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    if (createAvailabilityDto.employeeId !== user.employeeId) {
      throw new ForbiddenException(
        'Employees can only create availability for themselves',
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
        include: {
          employee: {
            select: {
              fullName: true,
            },
          },
        },
      });

      return new AvailabilityResponseDto(availability);
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
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    const availabilities = await this.prisma.availability.findMany({
      where: {
        startTime: {
          gte: from,
        },
        endTime: {
          lte: to,
        },
        employeeId: user.employeeId,
      },
      include: {
        employee: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return availabilities.map(
      (availability) => new AvailabilityResponseDto(availability),
    );
  }

  async findOne(
    id: number,
    currentUserId: number,
  ): Promise<AvailabilityResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    const availability = await this.prisma.availability.findUnique({
      where: { id, employeeId: user.employeeId },
      include: {
        employee: {
          select: {
            fullName: true,
          },
        },
      },
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

    return new AvailabilityResponseDto(availability);
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

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      throw new ForbiddenException('User must be associated with an employee');
    }

    if (availability.employeeId !== user.employeeId) {
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
        include: {
          employee: {
            select: {
              fullName: true,
            },
          },
        },
      });

      return new AvailabilityResponseDto(updatedAvailability);
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

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { employeeId: true },
    });

    if (!user?.employeeId || user.employeeId !== availability.employeeId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.availability.delete({
      where: { id },
    });

    return { message: 'Availability deleted successfully' };
  }
}
