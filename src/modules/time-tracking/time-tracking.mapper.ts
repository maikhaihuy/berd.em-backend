import { TimeLogResponseDto } from './dto/time-log-response.dto';
import { TimeLogWithRelations } from './time-tracking.types';

export class TimeLogMapper {
  // Uses the DTO constructor rather than field-by-field projection so the
  // response is byte-identical to the pre-refactor output — notably the
  // `multiplier` Decimal, which serializes to a JSON string and feeds downstream
  // payroll. Do not coerce it here.
  static toDto(this: void, timeLog: TimeLogWithRelations): TimeLogResponseDto {
    return new TimeLogResponseDto(timeLog);
  }

  static toDtos(timeLogs: TimeLogWithRelations[]): TimeLogResponseDto[] {
    return timeLogs.map(TimeLogMapper.toDto);
  }
}
