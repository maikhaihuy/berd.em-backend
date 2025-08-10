import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { UsersService } from '@modules/users/users.service';
import { AuthUserResponseDto } from '@modules/users/dto/auth-user-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<AuthUserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { username: loginDto.username },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(
        `User with ID ${loginDto.username} not found.`,
      );
    }

    if (await bcrypt.compare(loginDto.password, user.password)) {
      return new AuthUserResponseDto(user);
    }

    return null;
  }

  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    // 1. Kiểm tra username đã tồn tại chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { username: registerDto.username },
    });
    if (existingUser) {
      throw new BadRequestException('Username already exists');
    }

    // 2. Hash mật khẩu
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 3. Tìm role 'employee' mặc định để gán
    const employeeRole = await this.prisma.role.findFirst({
      where: { name: 'employee' },
    });
    if (!employeeRole) {
      throw new NotFoundException(
        'Default "employee" role not found. Please seed the database.',
      );
    }

    // 4. Tạo user mới và gán role
    try {
      const user = await this.prisma.user.create({
        data: {
          username: registerDto.username,
          password: hashedPassword,
          roles: {
            connect: { id: employeeRole.id },
          },
          // Cần một cách để xác định createdBy và updatedBy, ví dụ: user mặc định
          createdBy: 1,
          updatedBy: 1,
        },
      });

      // 5. Trả về user mà không bao gồm mật khẩu
      const { password, ...result } = user;
      return result;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Failed to create user.');
    }
  }

  login(user: AuthUserResponseDto): AuthResponseDto {
    console.log(user);
    const payload = {
      username: user.username,
      sub: user.id,
      roles: user.roles.map((role) => role.name),
    };
    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
    } as AuthResponseDto;
  }
}
