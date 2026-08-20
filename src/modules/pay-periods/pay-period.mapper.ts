import { PayPeriodResponseDto } from './dto/pay-period-response.dto';
import { PayPeriodWithRelations } from './pay-period.types';

export class PayPeriodMapper {
  static toDto(
    this: void,
    payPeriod: PayPeriodWithRelations,
  ): PayPeriodResponseDto {
    return {
      id: payPeriod.id,
      startDate: payPeriod.startDate,
      endDate: payPeriod.endDate,
      status: payPeriod.status,
      notes: payPeriod.notes,
      createdAt: payPeriod.createdAt,
      createdBy: payPeriod.createdBy,
      updatedAt: payPeriod.updatedAt,
      updatedBy: payPeriod.updatedBy,
    };
  }

  static toDtos(payPeriods: PayPeriodWithRelations[]): PayPeriodResponseDto[] {
    return payPeriods.map(PayPeriodMapper.toDto);
  }
}
