// src/common/logger/logger.service.ts
import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService extends ConsoleLogger {
  log(message: any, context?: string) {
    super.log(this.formatMessage(message, context));
  }

  warn(message: any, context?: string) {
    super.warn(this.formatMessage(message, context));
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      super.debug(this.formatMessage(message, context));
    }
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      super.verbose(this.formatMessage(message, context));
    }
  }

  error(message: any, stackOrError?: string | Error, context?: string) {
    const formatted = this.formatMessage(message, context);

    if (stackOrError instanceof Error) {
      super.error(formatted, stackOrError.stack);
      // Gửi lỗi thật sự lên Sentry
      Sentry.captureException(stackOrError, {
        tags: { context: context || 'UnknownContext' },
        extra: { message },
      });
    } else {
      super.error(formatted, stackOrError);
      Sentry.captureMessage(formatted, {
        level: 'error',
        tags: { context: context || 'UnknownContext' },
      });
    }
  }

  protected formatMessage(message: any, context?: string) {
    const prefix = context ? `[${context}]` : '';
    if (typeof message === 'object') {
      try {
        return `${prefix} ${JSON.stringify(message)}`;
      } catch {
        return `${prefix} ${String(message)}`;
      }
    }
    return `${prefix} ${message}`;
  }
}
