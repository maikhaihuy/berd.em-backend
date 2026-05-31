import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShiftStatus, TaskType } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateMasterShiftDto } from './dto/create-master-shift.dto';
import { UpdateMasterShiftDto } from './dto/update-master-shift.dto';

@Injectable()
export class MasterShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMasterShiftDto, currentUserId: number) {
    if (dto.masterShiftTemplateId) {
      await this.ensureTemplateMatchesBranch(
        dto.masterShiftTemplateId,
        dto.branchId,
      );
    } else {
      await this.ensureBranch(dto.branchId);
    }
    this.validateTimeRange(dto.startTime, dto.endTime);

    try {
      return await this.prisma.masterShift.create({
        data: {
          branchId: dto.branchId,
          masterShiftTemplateId: dto.masterShiftTemplateId,
          workDate: new Date(dto.workDate),
          title: dto.title,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          status: dto.status ?? ShiftStatus.ACTIVE,
          note: dto.note,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: this.include,
      });
    } catch (error) {
      this.handleKnownError(error);
      throw error;
    }
  }

  async generateFromTemplate(
    masterShiftTemplateId: number,
    workDate: string,
    currentUserId: number,
  ) {
    const template = await this.prisma.masterShiftTemplate.findUnique({
      where: { id: masterShiftTemplateId },
      include: { subShiftTemplates: true, taskTemplates: true },
    });
    if (!template)
      throw new NotFoundException('Master shift template not found');

    const workDateValue = new Date(workDate);
    const startTime = this.combineDateAndTemplateTime(
      workDateValue,
      template.startTime,
    );
    const endTime = this.combineDateAndTemplateTime(
      workDateValue,
      template.endTime,
    );

    return this.prisma.$transaction(async (tx) => {
      const masterShift = await tx.masterShift.create({
        data: {
          branchId: template.branchId,
          masterShiftTemplateId: template.id,
          workDate: workDateValue,
          title: template.name,
          startTime,
          endTime,
          status: ShiftStatus.ACTIVE,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
      });

      const subShifts = await Promise.all(
        template.subShiftTemplates.map((subTemplate) =>
          tx.subShift.create({
            data: {
              masterShiftId: masterShift.id,
              subShiftTemplateId: subTemplate.id,
              title: subTemplate.name,
              type: subTemplate.type,
              startTime: this.combineDateAndTemplateTime(
                workDateValue,
                subTemplate.startTime,
              ),
              endTime: this.combineDateAndTemplateTime(
                workDateValue,
                subTemplate.endTime,
              ),
              maxAssignments: subTemplate.maxAssignments,
              status: ShiftStatus.ACTIVE,
              createdBy: currentUserId,
              updatedBy: currentUserId,
            },
          }),
        ),
      );

      await Promise.all(
        template.taskTemplates.map((taskTemplate) => {
          const matchedSubShift =
            taskTemplate.type === TaskType.DEDICATED
              ? subShifts.find(
                  (subShift) =>
                    subShift.subShiftTemplateId ===
                    taskTemplate.subShiftTemplateId,
                )
              : undefined;

          return tx.task.create({
            data: {
              taskTemplateId: taskTemplate.id,
              masterShiftId:
                taskTemplate.type === TaskType.DEDICATED
                  ? undefined
                  : masterShift.id,
              subShiftId: matchedSubShift?.id,
              title: taskTemplate.title,
              description: taskTemplate.description,
              type: taskTemplate.type,
              sortOrder: taskTemplate.sortOrder,
              note: taskTemplate.note,
              createdBy: currentUserId,
              updatedBy: currentUserId,
            },
          });
        }),
      );

      return tx.masterShift.findUnique({
        where: { id: masterShift.id },
        include: this.include,
      });
    });
  }

  findAll(branchId?: number, from?: string, to?: string) {
    return this.prisma.masterShift.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(from || to
          ? {
              workDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: this.include,
      orderBy: [{ workDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findOne(id: number) {
    const shift = await this.prisma.masterShift.findUnique({
      where: { id },
      include: this.include,
    });
    if (!shift) throw new NotFoundException('Master shift not found');
    return shift;
  }

  async update(id: number, dto: UpdateMasterShiftDto, currentUserId: number) {
    const existing = await this.findOne(id);
    const branchId = dto.branchId ?? existing.branchId;
    if (dto.masterShiftTemplateId) {
      await this.ensureTemplateMatchesBranch(
        dto.masterShiftTemplateId,
        branchId,
      );
    } else if (dto.branchId) {
      await this.ensureBranch(dto.branchId);
    }
    this.validateTimeRange(
      dto.startTime ?? existing.startTime.toISOString(),
      dto.endTime ?? existing.endTime.toISOString(),
    );

    return this.prisma.masterShift.update({
      where: { id },
      data: {
        ...dto,
        workDate: dto.workDate ? new Date(dto.workDate) : undefined,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        updatedBy: currentUserId,
      },
      include: this.include,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.masterShift.delete({ where: { id } });
    return { message: 'Master shift deleted successfully' };
  }

  private include = {
    branch: { select: { id: true, name: true, abbreviation: true } },
    masterShiftTemplate: { select: { id: true, name: true } },
    subShifts: true,
    tasks: { include: { completion: true } },
  };

  private async ensureBranch(branchId: number) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private async ensureTemplateMatchesBranch(
    templateId: number,
    branchId: number,
  ) {
    const template = await this.prisma.masterShiftTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template)
      throw new NotFoundException('Master shift template not found');
    if (template.branchId !== branchId) {
      throw new BadRequestException(
        'Master shift branch must match template branch',
      );
    }
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (new Date(startTime) >= new Date(endTime)) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  private combineDateAndTemplateTime(date: Date, templateTime: Date) {
    const combined = new Date(date);
    combined.setHours(
      templateTime.getHours(),
      templateTime.getMinutes(),
      templateTime.getSeconds(),
      templateTime.getMilliseconds(),
    );
    return combined;
  }

  private handleKnownError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'Master shift with this branch, date, and title already exists',
      );
    }
  }
}
