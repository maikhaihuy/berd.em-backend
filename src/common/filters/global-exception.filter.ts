import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let source = 'Application';
    let details: unknown;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      status = exception.getStatus();
      if (typeof body === 'object' && body !== null) {
        const payload = body as Record<string, unknown>;
        const maybeMessage = payload.message;
        const maybeSource = payload.source;
        message =
          typeof maybeMessage === 'string' ? maybeMessage : exception.message;
        source = typeof maybeSource === 'string' ? maybeSource : source;
        details = Object.prototype.hasOwnProperty.call(payload, 'details')
          ? payload.details
          : details;
      } else {
        message = exception.message;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception, {
        tags: { layer: 'GlobalException' },
        extra: {
          url: request.url,
          method: request.method,
          body: request.body,
          status,
        },
      });
    }

    res.status(status).json({
      statusCode: status,
      message,
      source,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
