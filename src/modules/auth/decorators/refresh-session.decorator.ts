import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import { Request } from 'express';

export const RefreshSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RefreshSessionDto => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as RefreshSessionDto;
  },
);
