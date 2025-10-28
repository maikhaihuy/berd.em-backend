// src/common/exception.module.ts
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { BadRequestException } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';

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
            const formatted = errors.map((err) => ({
              field: err.property,
              errors: Object.values(err.constraints || {}),
            }));
            return new BadRequestException({
              message: 'Validation failed',
              errors: formatted,
            });
          },
        }),
    },

    // === Prisma Filter ===
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },

    // === Global Filter ===
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class ExceptionModule {
  constructor() {
    // Init Sentry khi module load
    if (!Sentry.isInitialized()) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new ProfilingIntegration(),
        ],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
      });
      console.log('[ExceptionModule] Sentry initialized');
    }
  }
}
