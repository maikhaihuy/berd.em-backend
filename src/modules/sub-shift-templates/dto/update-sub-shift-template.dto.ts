import { PartialType } from '@nestjs/swagger';
import { CreateSubShiftTemplateDto } from './create-sub-shift-template.dto';

export class UpdateSubShiftTemplateDto extends PartialType(
  CreateSubShiftTemplateDto,
) {}
