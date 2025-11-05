import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';
import { Request } from 'express';

export const AuthenticatedUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUserDto => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUserDto;
  },
);
