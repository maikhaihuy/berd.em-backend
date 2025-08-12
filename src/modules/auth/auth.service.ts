import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { TokenDto } from './dto/token.dto';
import { ConfigService } from '@nestjs/config';
import { AuthUserDto } from './dto/auth-user.dto';
import { RoleDto } from '@modules/roles/dto/role.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
  //   // 1. Kiểm tra username đã tồn tại chưa
  //   const existingUser = await this.prisma.user.findUnique({
  //     where: { username: registerDto.username },
  //   });
  //   if (existingUser) {
  //     throw new BadRequestException('Username already exists');
  //   }

  //   // 2. Hash mật khẩu
  //   const hashedPassword = await bcrypt.hash(registerDto.password, 10);

  //   // 3. Tìm role 'employee' mặc định để gán
  //   const employeeRole = await this.prisma.role.findFirst({
  //     where: { name: 'employee' },
  //   });
  //   if (!employeeRole) {
  //     throw new NotFoundException(
  //       'Default "employee" role not found. Please seed the database.',
  //     );
  //   }

  //   // 4. Tạo user mới và gán role
  //   try {
  //     const user = await this.prisma.user.create({
  //       data: {
  //         username: registerDto.username,
  //         password: hashedPassword,
  //         roles: {
  //           connect: { id: employeeRole.id },
  //         },
  //         // Cần một cách để xác định createdBy và updatedBy, ví dụ: user mặc định
  //         createdBy: 1,
  //         updatedBy: 1,
  //       },
  //     });

  //     // 5. Trả về user mà không bao gồm mật khẩu
  //     const { password, ...result } = user;
  //     console.log(password);
  //     return result;
  //   } catch (error) {
  //     console.log(error);
  //     throw new BadRequestException('Failed to create user.');
  //   }
  // }

  async login(user: AuthUserDto): Promise<TokenDto> {
    const authToken = await this.getTokens(user.id, user.username, user.roles);
    return authToken as TokenDto;
  }

  async refreshToken(user: AuthUserDto): Promise<TokenDto> {
    const tokens = await this.getTokens(user.id, user.username, user.roles);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  async forgotPassword(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      // Không báo lỗi để tránh lộ thông tin email có tồn tại hay không
      return {
        message:
          'Nếu email tồn tại, bạn sẽ nhận được một link để đặt lại mật khẩu.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = await bcrypt.hash(resetToken, 10);
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpires,
      },
    });

    // TODO: Gửi email chứa `resetToken` cho người dùng
    console.log(`Reset Token (gửi cho user): ${resetToken}`);

    return { message: 'Link đặt lại mật khẩu đã được gửi đến email của bạn.' };
  }

  async resetPassword(token: string, newPass: string) {
    const hashedToken = await bcrypt.hash(token, 10);
    const user = await this.prisma.user.findFirst({
      where: { hashedRefreshToken: hashedToken },
    });
    if (
      !user ||
      !(user.passwordResetExpires instanceof Date) ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      throw new ForbiddenException('Token không hợp lệ hoặc đã hết hạn.');
    }

    const password = await bcrypt.hash(newPass, 10);
    const passwordResetToken = null;
    const passwordResetExpires = null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        passwordResetToken,
        passwordResetExpires,
      },
    });

    return { message: 'Mật khẩu đã được đặt lại thành công.' };
  }

  // --- Helper Methods ---
  private async getTokens(userId: number, email: string, roles: RoleDto[]) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, roles },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRATION_TIME'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, roles },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>(
            'JWT_REFRESH_EXPIRATION_TIME',
          ),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(userId: number, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }
}
