import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateSubShiftTemplateDto } from './dto/create-sub-shift-template.dto';
import { UpdateSubShiftTemplateDto } from './dto/update-sub-shift-template.dto';

@Injectable()
export class SubShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubShiftTemplateDto, currentUserId: number) {
    await this.ensureBranchAndMasterTemplate(
      dto.branchId,
      dto.masterShiftTemplateId,
    );
    this.validateTimeRange(dto.startTime, dto.endTime);

    return this.prisma.subShiftTemplate.create({
      data: {
        branchId: dto.branchId,
        masterShiftTemplateId: dto.masterShiftTemplateId,
        name: dto.name,
        type: dto.type,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        maxAssignments: dto.maxAssignments,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? ShiftStatus.ACTIVE,
        note: dto.note,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: this.include,
    });
  }

  findAll(branchId?: number, masterShiftTemplateId?: number) {
    return this.prisma.subShiftTemplate.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(masterShiftTemplateId ? { masterShiftTemplateId } : {}),
      },
      include: this.include,
      orderBy: [
        { branchId: 'asc' },
        { sortOrder: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  async findOne(id: number) {
    const template = await this.prisma.subShiftTemplate.findUnique({
      where: { id },
      include: this.include,
    });
    if (!template) throw new NotFoundException('Sub shift template not found');
    return template;
  }

  async update(
    id: number,
    dto: UpdateSubShiftTemplateDto,
    currentUserId: number,
  ) {
    const existing = await this.findOne(id);
    const branchId = dto.branchId ?? existing.branchId;
    const masterShiftTemplateId =
      dto.masterShiftTemplateId ?? existing.masterShiftTemplateId;
    await this.ensureBranchAndMasterTemplate(branchId, masterShiftTemplateId);

    const startTime = dto.startTime ?? existing.startTime.toISOString();
    const endTime = dto.endTime ?? existing.endTime.toISOString();
    this.validateTimeRange(startTime, endTime);

    return this.prisma.subShiftTemplate.update({
      where: { id },
      data: {
        ...dto,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        updatedBy: currentUserId,
      },
      include: this.include,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.subShiftTemplate.delete({ where: { id } });
    return { message: 'Sub shift template deleted successfully' };
  }

  private include = {
    branch: { select: { id: true, name: true, abbreviation: true } },
    masterShiftTemplate: { select: { id: true, name: true } },
    taskTemplates: true,
  };

  private async ensureBranchAndMasterTemplate(
    branchId: number,
    masterShiftTemplateId: number,
  ) {
    const template = await this.prisma.masterShiftTemplate.findUnique({
      where: { id: masterShiftTemplateId },
    });
    if (!template) {
      throw new NotFoundException('Master shift template not found');
    }
    if (template.branchId !== branchId) {
      throw new BadRequestException(
        'Sub shift template branch must match master shift template branch',
      );
    }
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (new Date(startTime) >= new Date(endTime)) {
      throw new BadRequestException('Start time must be before end time');
    }
  }
}
