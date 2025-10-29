import { DatabaseException } from '@common/exceptions/database.exception';
import { Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Error) {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '';

    // Prisma error type check
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      statusCode = this.getHttpStatus(exception.code);
      message = this.getErrorMessage(exception);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided to Prisma query';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Failed to initialize database connection';
    } else if (exception instanceof Prisma.PrismaClientRustPanicError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Prisma engine panicked. Please restart the server.';
    } else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown error occurred while accessing the database';
    }

    throw new DatabaseException(
      message,
      statusCode,
      exception.constructor.name,
    );
  }

  /**
   * Map Prisma error codes to HTTP status
   */
  private getHttpStatus(code: string): HttpStatus {
    switch (code) {
      case 'P2002': // Unique constraint failed
        return HttpStatus.CONFLICT;
      case 'P2025': // Record not found
        return HttpStatus.NOT_FOUND;
      case 'P2003': // Foreign key constraint failed
        return HttpStatus.BAD_REQUEST;
      case 'P2014': // Invalid relation
        return HttpStatus.BAD_REQUEST;
      case 'P2000': // Value too long
        return HttpStatus.BAD_REQUEST;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  private getUniqueTarget(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const meta = exception.meta as { target?: unknown } | undefined;
    const rawTarget = meta?.target;
    return Array.isArray(rawTarget)
      ? rawTarget.join(', ')
      : typeof rawTarget === 'string'
        ? rawTarget
        : 'unknown field';
  }

  /**
   * Friendly error messages
   */
  private getErrorMessage(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    switch (exception.code) {
      case 'P2002':
        return `Unique constraint failed on ${this.getUniqueTarget(exception)}`;
      case 'P2025':
        return 'Record not found';
      case 'P2003':
        return 'Foreign key constraint failed';
      case 'P2014':
        return 'Invalid relation';
      case 'P2000':
        return 'Value too long for column';
      default:
        return exception.message;
    }
  }
}
