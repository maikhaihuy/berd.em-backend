import { UnauthorizedException } from '@nestjs/common';

// src/modules/auth/exceptions/auth.exceptions.ts
export class TokenExpiredException extends UnauthorizedException {
  constructor(message = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenException extends UnauthorizedException {
  constructor(message = 'Invalid token') {
    super(message, 'INVALID_TOKEN');
  }
}
