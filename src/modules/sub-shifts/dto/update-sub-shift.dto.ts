import { PartialType } from '@nestjs/swagger';
import { CreateSubShiftDto } from './create-sub-shift.dto';

export class UpdateSubShiftDto extends PartialType(CreateSubShiftDto) {}
