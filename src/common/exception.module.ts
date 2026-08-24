// src/common/exception.module.ts
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import * as Sentry from '@sentry/node';

import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { BadRequestException } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';
import { buildValidationErrorMap } from './helpers/validation-errors.helper';

@Module({
  providers: [
    LoggerService,
    // === ValidationPipe Global ===
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          transform: true,
          forbidNonWhitelisted: true,
          exceptionFactory: (errors) => {
            return new BadRequestException({
              message: 'Validation failed',
              errors: buildValidationErrorMap(errors),
            });
          },
        }),
    },

    // === Prisma Filter ===
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },

    // === Global Filter ===
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [LoggerService],
})
export class ExceptionModule {
  constructor(private readonly logger: LoggerService) {
    // Init Sentry khi module load
    if (!Sentry.isInitialized()) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        // ✅ Sentry v10 style integrations
        integrations: [
          // Sentry.httpIntegration(),
          // Sentry.expressIntegration(),
          // nodeProfilingIntegration(),
        ],
        // ✅ Config sample rates
        tracesSampleRate: 1.0,
        profilesSampleRate: 0,
      });
      this.logger.log('✅ Sentry initialized (v10.x)', 'ExceptionModule');
    }
  }
}
