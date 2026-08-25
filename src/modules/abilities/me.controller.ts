import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkipPermissions } from '@common/decorators/skip-permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AbilitiesService } from './abilities.service';
import { AbilityRuleDto } from './dto/ability-rule.dto';

@ApiTags('abilities')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly abilitiesService: AbilitiesService) {}

  @SkipPermissions()
  @Get('me/abilities')
  @ApiOperation({ summary: "Get the caller's own resolved abilities" })
  @ApiResponse({
    status: 200,
    description: "The caller's resolved ability rules",
    type: [AbilityRuleDto],
  })
  getMyAbilities(
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): AbilityRuleDto[] {
    return this.abilitiesService.getAbilitiesForCaller(user);
  }
}
