import { PartialType } from '@nestjs/swagger';
import { CreateMasterShiftDto } from './create-master-shift.dto';

export class UpdateMasterShiftDto extends PartialType(CreateMasterShiftDto) {}
