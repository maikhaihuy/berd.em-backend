import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsInt,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWorkSlotDto } from './create-work-slot.dto';

export class BulkCreateWorkSlotDto {
  @ApiProperty({
    description: 'Array of work slots to create',
    type: [CreateWorkSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkSlotDto)
  workSlots!: CreateWorkSlotDto[];

  @ApiProperty({ description: 'ID of the user creating these work slots' })
  @IsInt()
  @IsNotEmpty()
  createdBy!: number;
}
