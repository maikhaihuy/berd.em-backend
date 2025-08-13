import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PublicUserDto } from '../dto/public-user.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  async validate(username: string, password: string): Promise<PublicUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${username} not found.`);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(`Username or password are not match.`);
    }

    return new PublicUserDto(user);
  }
}
