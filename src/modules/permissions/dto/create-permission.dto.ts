import { ApiProperty } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty()
  action: string;

  @ApiProperty()
  subject?: string;

  @ApiProperty()
  description?: string;
}
