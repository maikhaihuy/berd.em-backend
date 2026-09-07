import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ description: 'Durable, publicly-fetchable URL of the file.' })
  url: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty()
  createdAt: Date;
}
