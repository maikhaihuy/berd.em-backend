import { BranchScheduleConfigResponseDto } from './dto/branch-schedule-config-response.dto';
import { BranchScheduleConfigWithRelations } from './branch-schedule-config.types';

export class BranchScheduleConfigMapper {
  static toDto(
    this: void,
    config: BranchScheduleConfigWithRelations,
  ): BranchScheduleConfigResponseDto {
    return {
      id: config.id,
      branchId: config.branchId,
      allowCustomAvailabilityTime: config.allowCustomAvailabilityTime,
      availabilityOpenDaysBefore: config.availabilityOpenDaysBefore,
      availabilityCloseHoursBefore: config.availabilityCloseHoursBefore,
      scheduleGenerationDay: config.scheduleGenerationDay,
      note: config.note,
      createdAt: config.createdAt,
      createdBy: config.createdBy,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    };
  }

  static toDtos(
    configs: BranchScheduleConfigWithRelations[],
  ): BranchScheduleConfigResponseDto[] {
    return configs.map(BranchScheduleConfigMapper.toDto);
  }
}
