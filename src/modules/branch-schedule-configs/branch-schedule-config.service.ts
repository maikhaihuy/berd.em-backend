import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateBranchScheduleConfigDto } from './dto/create-branch-schedule-config.dto';
import { UpdateBranchScheduleConfigDto } from './dto/update-branch-schedule-config.dto';
import { BranchScheduleConfigResponseDto } from './dto/branch-schedule-config-response.dto';
import { branchScheduleConfigInclude } from './branch-schedule-config.types';
import { BranchScheduleConfigMapper } from './branch-schedule-config.mapper';

@Injectable()
export class BranchScheduleConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateBranchScheduleConfigDto,
    currentUserId: number,
  ): Promise<BranchScheduleConfigResponseDto> {
    try {
      const config = await this.prisma.branchScheduleConfig.create({
        data: {
          ...dto,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: branchScheduleConfigInclude,
      });
      return BranchScheduleConfigMapper.toDto(config);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Branch ${dto.branchId} already has a schedule config.`,
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<BranchScheduleConfigResponseDto[]> {
    const configs = await this.prisma.branchScheduleConfig.findMany({
      include: branchScheduleConfigInclude,
      orderBy: { branchId: 'asc' },
    });
    return BranchScheduleConfigMapper.toDtos(configs);
  }

  async findOne(id: number): Promise<BranchScheduleConfigResponseDto> {
    const config = await this.prisma.branchScheduleConfig.findUnique({
      where: { id },
      include: branchScheduleConfigInclude,
    });
    if (!config) {
      throw new NotFoundException(
        `Branch schedule config with ID ${id} not found.`,
      );
    }
    return BranchScheduleConfigMapper.toDto(config);
  }

  async findByBranch(
    branchId: number,
  ): Promise<BranchScheduleConfigResponseDto> {
    const config = await this.prisma.branchScheduleConfig.findUnique({
      where: { branchId },
      include: branchScheduleConfigInclude,
    });
    if (!config) {
      throw new NotFoundException(`Branch ${branchId} has no schedule config.`);
    }
    return BranchScheduleConfigMapper.toDto(config);
  }

  async update(
    id: number,
    dto: UpdateBranchScheduleConfigDto,
    currentUserId: number,
  ): Promise<BranchScheduleConfigResponseDto> {
    try {
      const config = await this.prisma.branchScheduleConfig.update({
        where: { id },
        data: { ...dto, updatedBy: currentUserId },
        include: branchScheduleConfigInclude,
      });
      return BranchScheduleConfigMapper.toDto(config);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Branch schedule config with ID ${id} not found.`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.branchScheduleConfig.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Branch schedule config with ID ${id} not found.`,
        );
      }
      throw error;
    }
  }
}
