import { HttpException, HttpStatus } from '@nestjs/common';

export class BaseException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    source = 'Application',
    details?: unknown,
  ) {
    super(
      {
        message,
        source,
        details,
      },
      status,
    );
  }
}
