// src/common/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any = { message: 'Internal server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body = typeof res === 'string' ? { message: res } : res;
    }

    // 🧠 chỉ log lỗi thật sự (500+, hoặc non-HttpException)
    const shouldLogToSentry =
      !(exception instanceof HttpException) || status >= 500;

    if (shouldLogToSentry) {
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

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...body,
    });
  }
}
