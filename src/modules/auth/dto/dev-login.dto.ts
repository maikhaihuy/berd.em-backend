import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

@ValidatorConstraint({ name: 'DevLoginIdentifier', async: false })
class DevLoginIdentifierConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args?: ValidationArguments): boolean {
    if (!args) {
      return false;
    }

    const dto = args.object as DevLoginDto;
    const identifiers = [dto.employeeId, dto.email, dto.phone].filter(
      (value) => typeof value === 'string' && value.length > 0,
    );

    return identifiers.length === 1;
  }

  defaultMessage(): string {
    return 'INVALID_DEV_LOGIN_IDENTIFIER';
  }
}

export class DevLoginDto {
  @Validate(DevLoginIdentifierConstraint)
  private readonly identifierRule?: string;

  @ApiPropertyOptional({ example: '1' })
  @Transform(({ value }) => trimValue(value))
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'staff@example.com' })
  @Transform(({ value }) => trimValue(value))
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @Transform(({ value }) => trimValue(value))
  @IsOptional()
  @IsString()
  phone?: string;
}
