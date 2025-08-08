import { PartialType } from '@nestjs/swagger';
import { CreatePermissionDto } from './create-permission.dto';

export class UpdatePermissinoDto extends PartialType(CreatePermissionDto) {
  id: number;
}
