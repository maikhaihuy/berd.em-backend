// src/auth/guards/jwt-refresh.guard.ts
import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  canActivate(context: ExecutionContext) {
    // Gọi phương thức canActivate của lớp cha để bắt đầu quy trình xác thực
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    console.log('info: ', info);
    // Nếu có lỗi hoặc người dùng không tồn tại, ném ra ngoại lệ
    if (err || !user) {
      throw (
        err || new UnauthorizedException('Invalid or expired refresh token')
      );
    }
    // Trả về đối tượng người dùng đã được xác thực
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
