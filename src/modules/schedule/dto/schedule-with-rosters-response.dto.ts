import { RosterResponseDto } from '@modules/roster/dto/roster-response.dto';
import { ScheduleResponseDto } from './schedule-response.dto';

export class SchduleWithRostersResponseDto extends ScheduleResponseDto {
  rosters: RosterResponseDto[];
}
