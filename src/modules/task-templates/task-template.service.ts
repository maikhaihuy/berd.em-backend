import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskType } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';

@Injectable()
export class TaskTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTaskTemplateDto, currentUserId: number) {
    await this.validateScope(dto);
    return this.prisma.taskTemplate.create({
      data: {
        branchId: dto.branchId,
        masterShiftTemplateId: dto.masterShiftTemplateId,
        subShiftTemplateId: dto.subShiftTemplateId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        note: dto.note,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: this.include,
    });
  }

  findAll(branchId?: number) {
    return this.prisma.taskTemplate.findMany({
      where: branchId ? { branchId } : undefined,
      include: this.include,
      orderBy: [{ branchId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOne(id: number) {
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id },
      include: this.include,
    });
    if (!template) throw new NotFoundException('Task template not found');
    return template;
  }

  async update(id: number, dto: UpdateTaskTemplateDto, currentUserId: number) {
    const existing = await this.findOne(id);
    await this.validateScope({
      branchId: dto.branchId ?? existing.branchId,
      masterShiftTemplateId:
        dto.masterShiftTemplateId ??
        existing.masterShiftTemplateId ??
        undefined,
      subShiftTemplateId:
        dto.subShiftTemplateId ?? existing.subShiftTemplateId ?? undefined,
      type: dto.type ?? existing.type,
      title: dto.title ?? existing.title,
    });

    return this.prisma.taskTemplate.update({
      where: { id },
      data: { ...dto, updatedBy: currentUserId },
      include: this.include,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.taskTemplate.delete({ where: { id } });
    return { message: 'Task template deleted successfully' };
  }

  private include = {
    branch: { select: { id: true, name: true, abbreviation: true } },
    masterShiftTemplate: { select: { id: true, name: true } },
    subShiftTemplate: { select: { id: true, name: true, type: true } },
  };

  private async validateScope(dto: {
    branchId: number;
    masterShiftTemplateId?: number;
    subShiftTemplateId?: number;
    type: TaskType;
    title: string;
  }) {
    if (dto.type === TaskType.DEDICATED) {
      if (!dto.subShiftTemplateId || dto.masterShiftTemplateId) {
        throw new BadRequestException(
          'Dedicated task templates must target one sub shift template only',
        );
      }
      const subTemplate = await this.prisma.subShiftTemplate.findUnique({
        where: { id: dto.subShiftTemplateId },
      });
      if (!subTemplate)
        throw new NotFoundException('Sub shift template not found');
      if (subTemplate.branchId !== dto.branchId) {
        throw new BadRequestException(
          'Task template branch must match target branch',
        );
      }
      return;
    }

    if (!dto.masterShiftTemplateId || dto.subShiftTemplateId) {
      throw new BadRequestException(
        'Shared task templates must target one master shift template only',
      );
    }
    const masterTemplate = await this.prisma.masterShiftTemplate.findUnique({
      where: { id: dto.masterShiftTemplateId },
    });
    if (!masterTemplate) {
      throw new NotFoundException('Master shift template not found');
    }
    if (masterTemplate.branchId !== dto.branchId) {
      throw new BadRequestException(
        'Task template branch must match target branch',
      );
    }
  }
}
