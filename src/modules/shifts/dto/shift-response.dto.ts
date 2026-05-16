import { ApiProperty } from '@nestjs/swagger';
import { ShiftDto } from './shift.dto';
import { BranchLiteDto } from '@modules/branches/dto/branch.dto';

export class ShiftResponseDto extends ShiftDto {
  @ApiProperty({ type: [Object] })
  branch!: BranchLiteDto;
}
