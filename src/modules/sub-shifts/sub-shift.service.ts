import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateSubShiftDto } from './dto/create-sub-shift.dto';
import { UpdateSubShiftDto } from './dto/update-sub-shift.dto';
import { SubShiftResponseDto } from './dto/sub-shift-response.dto';
import { SubShiftMapper } from './sub-shift.mapper';
import { subShiftInclude } from './sub-shift.types';
import type { AppAbility } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';

const SUBJECT = 'sub-shifts';

@Injectable()
export class SubShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateSubShiftDto,
    currentUserId: number,
  ): Promise<SubShiftResponseDto> {
    await this.ensureMasterAndTemplate(
      dto.masterShiftId,
      dto.subShiftTemplateId,
    );
    this.validateTimeRange(dto.startTime, dto.endTime);

    const subShift = await this.prisma.subShift.create({
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
      include: subShiftInclude,
    });
    return SubShiftMapper.toDto(subShift);
  }

  async findAll(
    ability: AppAbility,
    masterShiftId?: number,
  ): Promise<SubShiftResponseDto[]> {
    const subShifts = await this.prisma.subShift.findMany({
      where: {
        ...(masterShiftId ? { masterShiftId } : {}),
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: subShiftInclude,
      orderBy: [{ startTime: 'asc' }],
    });
    return SubShiftMapper.toDtos(subShifts);
  }

  async findOne(id: number, ability: AppAbility): Promise<SubShiftResponseDto> {
    const subShift = await this.prisma.subShift.findFirst({
      where: {
        id,
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: subShiftInclude,
    });
    if (!subShift) throw new NotFoundException('Sub shift not found');
    return SubShiftMapper.toDto(subShift);
  }

  private async findExisting(id: number): Promise<SubShiftResponseDto> {
    const subShift = await this.prisma.subShift.findUnique({
      where: { id },
      include: subShiftInclude,
    });
    if (!subShift) throw new NotFoundException('Sub shift not found');
    return SubShiftMapper.toDto(subShift);
  }

  async update(
    id: number,
    dto: UpdateSubShiftDto,
    currentUserId: number,
  ): Promise<SubShiftResponseDto> {
    const existing = await this.findExisting(id);
    await this.ensureMasterAndTemplate(
      dto.masterShiftId ?? existing.masterShiftId,
      dto.subShiftTemplateId ?? existing.subShiftTemplateId ?? undefined,
    );
    this.validateTimeRange(
      dto.startTime ?? existing.startTime.toISOString(),
      dto.endTime ?? existing.endTime.toISOString(),
    );

    const subShift = await this.prisma.subShift.update({
      where: { id },
      data: {
        ...dto,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        updatedBy: currentUserId,
      },
      include: subShiftInclude,
    });
    return SubShiftMapper.toDto(subShift);
  }

  async remove(id: number) {
    await this.findExisting(id);
    await this.prisma.subShift.delete({ where: { id } });
    return { message: 'Sub shift deleted successfully' };
  }

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
