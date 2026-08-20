import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma, PayPeriodStatus } from '@prisma/client';
import { CreatePayPeriodDto } from './dto/create-pay-period.dto';
import { UpdatePayPeriodDto } from './dto/update-pay-period.dto';
import { PayPeriodResponseDto } from './dto/pay-period-response.dto';
import { payPeriodInclude } from './pay-period.types';
import { PayPeriodMapper } from './pay-period.mapper';

@Injectable()
export class PayPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreatePayPeriodDto,
    currentUserId: number,
  ): Promise<PayPeriodResponseDto> {
    const payPeriod = await this.prisma.payPeriod.create({
      data: {
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: PayPeriodStatus.OPEN,
        notes: dto.notes,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: payPeriodInclude,
    });
    return PayPeriodMapper.toDto(payPeriod);
  }

  async findAll(): Promise<PayPeriodResponseDto[]> {
    const payPeriods = await this.prisma.payPeriod.findMany({
      orderBy: { startDate: 'desc' },
      include: payPeriodInclude,
    });
    return PayPeriodMapper.toDtos(payPeriods);
  }

  async findOne(id: number): Promise<PayPeriodResponseDto> {
    const payPeriod = await this.prisma.payPeriod.findUnique({
      where: { id },
      include: payPeriodInclude,
    });
    if (!payPeriod) {
      throw new NotFoundException(`Pay period with ID ${id} not found.`);
    }
    return PayPeriodMapper.toDto(payPeriod);
  }

  async update(
    id: number,
    dto: UpdatePayPeriodDto,
    currentUserId: number,
  ): Promise<PayPeriodResponseDto> {
    try {
      const payPeriod = await this.prisma.payPeriod.update({
        where: { id },
        data: {
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          notes: dto.notes,
          updatedBy: currentUserId,
        },
        include: payPeriodInclude,
      });
      return PayPeriodMapper.toDto(payPeriod);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Pay period with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.payPeriod.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Pay period with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async close(
    id: number,
    currentUserId: number,
  ): Promise<PayPeriodResponseDto> {
    return this.transition(
      id,
      PayPeriodStatus.OPEN,
      PayPeriodStatus.CLOSED,
      currentUserId,
    );
  }

  async finalize(
    id: number,
    currentUserId: number,
  ): Promise<PayPeriodResponseDto> {
    return this.transition(
      id,
      PayPeriodStatus.CLOSED,
      PayPeriodStatus.FINALIZED,
      currentUserId,
    );
  }

  private async transition(
    id: number,
    from: PayPeriodStatus,
    to: PayPeriodStatus,
    currentUserId: number,
  ): Promise<PayPeriodResponseDto> {
    const existing = await this.prisma.payPeriod.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Pay period with ID ${id} not found.`);
    }
    if (existing.status !== from) {
      throw new BadRequestException(
        `Pay period ${id} cannot move to ${to} from ${existing.status}; expected ${from}.`,
      );
    }
    const payPeriod = await this.prisma.payPeriod.update({
      where: { id },
      data: { status: to, updatedBy: currentUserId },
      include: payPeriodInclude,
    });
    return PayPeriodMapper.toDto(payPeriod);
  }
}
