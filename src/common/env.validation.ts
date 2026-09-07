import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  validateSync,
} from 'class-validator';

export class EnvVariables {
  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRATION: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRATION: string;

  @IsString()
  @IsOptional()
  AUTH_DEV_MODE?: string;

  @IsString()
  @IsOptional()
  AUTH_DEV_SECRET?: string;

  @IsString()
  @IsOptional()
  INITIAL_PASSWORD_TTL_DAYS?: string;

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS: string;

  @IsString()
  @IsNotEmpty()
  R2_ACCOUNT_ID: string;

  @IsString()
  @IsNotEmpty()
  R2_ACCESS_KEY_ID: string;

  @IsString()
  @IsNotEmpty()
  R2_SECRET_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  R2_BUCKET_NAME: string;

  @IsString()
  @IsNotEmpty()
  R2_PUBLIC_URL: string;

  @IsString()
  @IsOptional()
  UPLOAD_MAX_FILE_SIZE_BYTES?: string;

  @IsString()
  @IsOptional()
  UPLOAD_MAX_FILES_PER_REQUEST?: string;
}

export function validate(config: Record<string, unknown>) {
  if (config.NODE_ENV === 'production' && config.AUTH_DEV_MODE === 'true') {
    throw new Error(
      'Invalid auth configuration: AUTH_DEV_MODE must not be true in production.',
    );
  }

  const validatedConfig = plainToInstance(EnvVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
