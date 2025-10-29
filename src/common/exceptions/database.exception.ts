import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class DatabaseException extends BaseException {
  constructor(
    message: string,
    status: number = HttpStatus.INTERNAL_SERVER_ERROR,
    source: string = 'Database',
  ) {
    super(message, status, source);
  }
}
