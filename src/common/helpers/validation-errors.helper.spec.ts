import 'reflect-metadata';
import { Type, plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPositive,
  ValidateNested,
  validate,
} from 'class-validator';
import { buildValidationErrorMap } from './validation-errors.helper';

class EmployeeDto {
  @IsEmail()
  email!: string;
}

class ItemDto {
  @IsInt()
  @IsPositive()
  quantity!: number;
}

class OrderDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @ValidateNested()
  @Type(() => EmployeeDto)
  employee!: EmployeeDto;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
}

describe('buildValidationErrorMap', () => {
  it('maps a single failing field to an array of messages', async () => {
    const dto = plainToInstance(OrderDto, {
      name: '',
      email: 'valid@example.com',
      employee: { email: 'valid@example.com' },
      items: [],
    });

    const errors = await validate(dto);
    const map = buildValidationErrorMap(errors);

    expect(Object.keys(map)).toEqual(['name']);
    expect(map.name).toHaveLength(1);
    expect(Array.isArray(map.name)).toBe(true);
  });

  it('maps multiple failing fields independently', async () => {
    const dto = plainToInstance(OrderDto, {
      name: '',
      email: 'not-an-email',
      employee: { email: 'valid@example.com' },
      items: [],
    });

    const errors = await validate(dto);
    const map = buildValidationErrorMap(errors);

    expect(map).toHaveProperty('name');
    expect(map).toHaveProperty('email');
  });

  it('aggregates multiple failed constraints on the same field instead of overwriting', async () => {
    class MultiRuleDto {
      @IsInt()
      @IsPositive()
      count!: unknown;
    }
    const dto = plainToInstance(MultiRuleDto, { count: -1.5 });

    const errors = await validate(dto);
    const map = buildValidationErrorMap(errors);

    expect(map.count.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves nested object property paths', async () => {
    const dto = plainToInstance(OrderDto, {
      name: 'ok',
      email: 'valid@example.com',
      employee: { email: 'not-an-email' },
      items: [],
    });

    const errors = await validate(dto);
    const map = buildValidationErrorMap(errors);

    expect(map['employee.email']).toBeDefined();
    expect(map['email.employee']).toBeUndefined();
  });

  it('preserves indexed array item property paths for multiple failing items', async () => {
    const dto = plainToInstance(OrderDto, {
      name: 'ok',
      email: 'valid@example.com',
      employee: { email: 'valid@example.com' },
      items: [{ quantity: -1 }, { quantity: 0 }],
    });

    const errors = await validate(dto);
    const map = buildValidationErrorMap(errors);

    expect(map['items[0].quantity']).toBeDefined();
    expect(map['items[1].quantity']).toBeDefined();
  });

  it('returns an empty map when there are no errors', () => {
    expect(buildValidationErrorMap([])).toEqual({});
  });
});
