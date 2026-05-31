import { PartialType } from '@nestjs/swagger';
import { CreateMasterShiftTemplateDto } from './create-master-shift-template.dto';

export class UpdateMasterShiftTemplateDto extends PartialType(
  CreateMasterShiftTemplateDto,
) {}
