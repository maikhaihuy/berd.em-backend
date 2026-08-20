import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { VerifyTimeLogDto } from './dto/verify-time-log.dto';
import { TimeLogResponseDto } from './dto/time-log-response.dto';
import { TimeLogStatus, Prisma } from '@prisma/client';
import { timeLogInclude } from './time-tracking.types';
import { TimeLogMapper } from './time-tracking.mapper';

@Injectable()
export class TimeTrackingService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateTimeLogDto,
    currentUserId: number,
  ): Promise<TimeLogResponseDto> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: createDto.assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${createDto.assignmentId} not found`,
      );
    }

    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: createDto.employeeId },
    });

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${createDto.employeeId} not found`,
      );
    }

    const timeLog = await this.prisma.timeLog.create({
      data: {
        assignmentId: createDto.assignmentId,
        employeeId: createDto.employeeId,
        actualStartTime: createDto.actualStartTime
          ? new Date(createDto.actualStartTime)
          : null,
        actualEndTime: createDto.actualEndTime
          ? new Date(createDto.actualEndTime)
          : null,
        requestStartTime: createDto.requestStartTime
          ? new Date(createDto.requestStartTime)
          : null,
        requestEndTime: createDto.requestEndTime
          ? new Date(createDto.requestEndTime)
          : null,
        overtimeMinutes: createDto.overtimeMinutes,
        multiplier: createDto.multiplier,
        requestDate: createDto.requestDate
          ? new Date(createDto.requestDate)
          : null,
        requestReason: createDto.requestReason,
        status: createDto.status || TimeLogStatus.PENDING,
        note: createDto.note,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: timeLogInclude,
    });

    return TimeLogMapper.toDto(timeLog);
  }

  async findAll(): Promise<TimeLogResponseDto[]> {
    const timeLogs = await this.prisma.timeLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: timeLogInclude,
    });

    return TimeLogMapper.toDtos(timeLogs);
  }

  async findOne(id: number): Promise<TimeLogResponseDto> {
    const timeLog = await this.prisma.timeLog.findUnique({
      where: { id },
      include: timeLogInclude,
    });

    if (!timeLog) {
      throw new NotFoundException(`Time log with ID ${id} not found`);
    }

    return TimeLogMapper.toDto(timeLog);
  }

  async findByEmployee(employeeId: number): Promise<TimeLogResponseDto[]> {
    const timeLogs = await this.prisma.timeLog.findMany({
      where: { employeeId },
      orderBy: {
        createdAt: 'desc',
      },
      include: timeLogInclude,
    });

    return TimeLogMapper.toDtos(timeLogs);
  }

  async findByAssignment(assignmentId: number): Promise<TimeLogResponseDto[]> {
    const timeLogs = await this.prisma.timeLog.findMany({
      where: { assignmentId },
      orderBy: {
        createdAt: 'desc',
      },
      include: timeLogInclude,
    });

    return TimeLogMapper.toDtos(timeLogs);
  }

  async update(
    id: number,
    updateDto: UpdateTimeLogDto,
    currentUserId: number,
  ): Promise<TimeLogResponseDto> {
    const existingLog = await this.prisma.timeLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      throw new NotFoundException(`Time log with ID ${id} not found`);
    }

    const data: Prisma.TimeLogUpdateInput = {
      ...updateDto,
      updatedBy: currentUserId,
    };

    // Convert date strings to Date objects
    if (updateDto.actualStartTime) {
      data.actualStartTime = new Date(updateDto.actualStartTime);
    }
    if (updateDto.actualEndTime) {
      data.actualEndTime = new Date(updateDto.actualEndTime);
    }
    if (updateDto.requestStartTime) {
      data.requestStartTime = new Date(updateDto.requestStartTime);
    }
    if (updateDto.requestEndTime) {
      data.requestEndTime = new Date(updateDto.requestEndTime);
    }
    if (updateDto.requestDate) {
      data.requestDate = new Date(updateDto.requestDate);
    }

    const timeLog = await this.prisma.timeLog.update({
      where: { id },
      data,
      include: timeLogInclude,
    });

    return TimeLogMapper.toDto(timeLog);
  }

  async verify(
    id: number,
    verifyDto: VerifyTimeLogDto,
    verifierId: number,
  ): Promise<TimeLogResponseDto> {
    const existingLog = await this.prisma.timeLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      throw new NotFoundException(`Time log with ID ${id} not found`);
    }

    if (existingLog.status === TimeLogStatus.VERIFIED) {
      throw new BadRequestException('Time log is already verified');
    }

    const timeLog = await this.prisma.timeLog.update({
      where: { id },
      data: {
        status: verifyDto.status,
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        note: verifyDto.note || existingLog.note,
        updatedBy: verifierId,
      },
      include: timeLogInclude,
    });

    return TimeLogMapper.toDto(timeLog);
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.timeLog.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Time log with ID ${id} not found`);
      }
      throw error;
    }
  }
}
