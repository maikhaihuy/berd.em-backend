import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateSubShiftDto } from './dto/create-sub-shift.dto';
import { UpdateSubShiftDto } from './dto/update-sub-shift.dto';

@Injectable()
export class SubShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubShiftDto, currentUserId: number) {
    await this.ensureMasterAndTemplate(
      dto.masterShiftId,
      dto.subShiftTemplateId,
    );
    this.validateTimeRange(dto.startTime, dto.endTime);

    return this.prisma.subShift.create({
      data: {
        masterShiftId: dto.masterShiftId,
        subShiftTemplateId: dto.subShiftTemplateId,
        title: dto.title,
        type: dto.type,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        maxAssignments: dto.maxAssignments,
        status: dto.status ?? ShiftStatus.ACTIVE,
        note: dto.note,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: this.include,
    });
  }

  findAll(masterShiftId?: number) {
    return this.prisma.subShift.findMany({
      where: masterShiftId ? { masterShiftId } : undefined,
      include: this.include,
      orderBy: [{ startTime: 'asc' }],
    });
  }

  async findOne(id: number) {
    const subShift = await this.prisma.subShift.findUnique({
      where: { id },
      include: this.include,
    });
    if (!subShift) throw new NotFoundException('Sub shift not found');
    return subShift;
  }

  async update(id: number, dto: UpdateSubShiftDto, currentUserId: number) {
    const existing = await this.findOne(id);
    await this.ensureMasterAndTemplate(
      dto.masterShiftId ?? existing.masterShiftId,
      dto.subShiftTemplateId ?? existing.subShiftTemplateId ?? undefined,
    );
    this.validateTimeRange(
      dto.startTime ?? existing.startTime.toISOString(),
      dto.endTime ?? existing.endTime.toISOString(),
    );

    return this.prisma.subShift.update({
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
    await this.prisma.subShift.delete({ where: { id } });
    return { message: 'Sub shift deleted successfully' };
  }

  private include = {
    masterShift: {
      select: {
        id: true,
        title: true,
        branchId: true,
        workDate: true,
      },
    },
    subShiftTemplate: { select: { id: true, name: true, type: true } },
    tasks: { include: { completion: true } },
  };

  private async ensureMasterAndTemplate(
    masterShiftId: number,
    subShiftTemplateId?: number,
  ) {
    const masterShift = await this.prisma.masterShift.findUnique({
      where: { id: masterShiftId },
    });
    if (!masterShift) throw new NotFoundException('Master shift not found');
    if (!subShiftTemplateId) return;

    const template = await this.prisma.subShiftTemplate.findUnique({
      where: { id: subShiftTemplateId },
    });
    if (!template) throw new NotFoundException('Sub shift template not found');
    if (template.branchId !== masterShift.branchId) {
      throw new BadRequestException(
        'Sub shift template branch must match master shift branch',
      );
    }
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (new Date(startTime) >= new Date(endTime)) {
      throw new BadRequestException('Start time must be before end time');
    }
  }
}
