// src/common/filters/prisma-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let message = 'Database error';

    switch (exception.code) {
      case 'P2002':
        message = 'Unique constraint failed';
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        break;
      case 'P2025':
        message = 'Record not found';
        break;
    }

    // Gửi log lên Sentry
    Sentry.captureException(exception, {
      tags: { layer: 'PrismaException' },
      extra: { code: exception.code, meta: exception.meta },
    });

    response.status(400).json({
      statusCode: 400,
      message,
    });
  }
}
