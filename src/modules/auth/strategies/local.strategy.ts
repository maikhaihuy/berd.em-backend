import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';
import { PasswordService } from '../../../common/services/password.service';
import { userWithRoleInclude } from '@modules/users/user.types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  async validate(
    phoneNumber: string,
    password: string,
  ): Promise<AuthenticatedUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: userWithRoleInclude,
    });

    if (!user) {
      throw new NotFoundException(
        `User with username ${phoneNumber} not found.`,
      );
    }

    // TODO: Add status check when UserStatus enum is properly implemented
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active.');
    }
    if (!user.password) {
      throw new NotFoundException(
        `User login with 3rd party not with password.`,
      );
    }

    if (!(await this.passwordService.compare(password, user.password))) {
      throw new UnauthorizedException('Username or password are not match.');
    }

    return new AuthenticatedUserDto({
      userId: user.id,
      phone: user.phoneNumber,
    });
  }
}
