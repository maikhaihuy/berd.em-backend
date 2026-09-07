import { LoggerService } from '@common/logger/logger.service';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Response } from 'express';
import { MulterError } from 'multer';

// Multer aborts multipart parsing with a plain MulterError (not an
// HttpException) when a request violates the interceptor's `limits` (e.g.
// file too large, too many files) — without this mapping it would fall
// through to the generic 500 branch below.
function mapMulterError(exception: MulterError): BadRequestException {
  switch (exception.code) {
    case 'LIMIT_FILE_SIZE':
      return new BadRequestException(
        'One or more files exceed the maximum allowed file size.',
      );
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return new BadRequestException(
        'Too many files in a single upload request.',
      );
    default:
      return new BadRequestException(exception.message);
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(LoggerService) private readonly logService: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (exception instanceof MulterError) {
      exception = mapMulterError(exception);
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let source = 'Application';
    let details: unknown;
    let errors: Record<string, string[]> | undefined;

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
        if (
          typeof payload.errors === 'object' &&
          payload.errors !== null &&
          !Array.isArray(payload.errors)
        ) {
          errors = payload.errors as Record<string, string[]>;
        }
      } else {
        message = exception.message;
      }
    }

    if (status === HttpStatus.BAD_REQUEST && !errors) {
      errors = { _general: [message] };
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      if (process.env.NODE_ENV !== 'production') {
        // 💻 Log locally in dev/test
        this.logService.error(`[${status}] ${message}`, exception as Error);
      }
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
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
