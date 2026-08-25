import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AuthenticatedUserDto } from '../dto/authenticated-user.dto';
import { AccessTokenPayloadDto } from '../dto/access-token-payload.dto';
import { userWithRolePermissionsInclude } from '@modules/users/user.types';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(
    payload: AccessTokenPayloadDto,
  ): Promise<AuthenticatedUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: userWithRolePermissionsInclude,
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    return new AuthenticatedUserDto({
      userId: user.id,
      phone: user.phoneNumber,
      employeeId: user.employee?.id,
      branches: user.employee?.employeeBranches.map((eb) => eb.branchId) ?? [],
      managedBranches: user.managerBranches.map((mb) => mb.branchId),
      roles: user.userRoles.map((ur) => ur.role.name),
      permissions: user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => ({
          action: rp.permission.action,
          subject: rp.permission.subject,
          condition: rp.condition as Record<string, unknown> | null,
        })),
      ),
    });
  }
}
