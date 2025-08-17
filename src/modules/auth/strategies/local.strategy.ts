import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  async validate(
    username: string,
    password: string,
  ): Promise<AuthenticatedUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with username ${username} not found.`);
    }

    // TODO: Add status check when UserStatus enum is properly implemented
    // if (user.status !== 'ACTIVE') {
    //   throw new UnauthorizedException('User account is not active.');
    // }

    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Username or password are not match.');
    }

    return new AuthenticatedUserDto({
      id: user.id,
      username: user.username,
    });
  }
}
