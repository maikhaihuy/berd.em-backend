import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShiftStatus } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateMasterShiftTemplateDto } from './dto/create-master-shift-template.dto';
import { UpdateMasterShiftTemplateDto } from './dto/update-master-shift-template.dto';
import { MasterShiftTemplateResponseDto } from './dto/master-shift-template-response.dto';
import { MasterShiftTemplateMapper } from './master-shift-template.mapper';
import { masterShiftTemplateInclude } from './master-shift-template.types';

@Injectable()
export class MasterShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateMasterShiftTemplateDto,
    currentUserId: number,
  ): Promise<MasterShiftTemplateResponseDto> {
    await this.ensureBranch(dto.branchId);
    this.validateTimeRange(dto.startTime, dto.endTime);

    try {
      const template = await this.prisma.masterShiftTemplate.create({
        data: {
          branchId: dto.branchId,
          name: dto.name,
          abbreviation: dto.abbreviation,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          status: dto.status ?? ShiftStatus.ACTIVE,
          note: dto.note,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: masterShiftTemplateInclude,
      });
      return MasterShiftTemplateMapper.toDto(template);
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async findAll(
    branchId?: number,
  ): Promise<MasterShiftTemplateResponseDto[]> {
    const templates = await this.prisma.masterShiftTemplate.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: [{ branchId: 'asc' }, { startTime: 'asc' }],
      include: masterShiftTemplateInclude,
    });
    return MasterShiftTemplateMapper.toDtos(templates);
  }

  async findOne(id: number): Promise<MasterShiftTemplateResponseDto> {
    const template = await this.prisma.masterShiftTemplate.findUnique({
      where: { id },
      include: masterShiftTemplateInclude,
    });
    if (!template)
      throw new NotFoundException('Master shift template not found');
    return MasterShiftTemplateMapper.toDto(template);
  }

  async update(
    id: number,
    dto: UpdateMasterShiftTemplateDto,
    currentUserId: number,
  ): Promise<MasterShiftTemplateResponseDto> {
    const existing = await this.findOne(id);
    if (dto.branchId) await this.ensureBranch(dto.branchId);
    const startTime = dto.startTime ?? existing.startTime.toISOString();
    const endTime = dto.endTime ?? existing.endTime.toISOString();
    this.validateTimeRange(startTime, endTime);

    try {
      const template = await this.prisma.masterShiftTemplate.update({
        where: { id },
        data: {
          ...dto,
          startTime: dto.startTime ? new Date(dto.startTime) : undefined,
          endTime: dto.endTime ? new Date(dto.endTime) : undefined,
          updatedBy: currentUserId,
        },
        include: masterShiftTemplateInclude,
      });
      return MasterShiftTemplateMapper.toDto(template);
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.masterShiftTemplate.delete({ where: { id } });
    return { message: 'Master shift template deleted successfully' };
  }

  private async ensureBranch(branchId: number) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch)
      throw new NotFoundException(`Branch with ID ${branchId} not found`);
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (new Date(startTime) >= new Date(endTime)) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  private handleKnownError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'Master shift template with this branch and name already exists',
      );
    }
  }
}
