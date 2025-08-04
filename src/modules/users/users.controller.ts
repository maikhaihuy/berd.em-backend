import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { AbilitiesGuard } from '../../common/guards/abilities.guard';
// import { CheckAbilities } from '../../common/decorators/abilities.decorator';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  // @CheckAbilities({ action: 'manage', subject: 'all' })
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Returns all users' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Put(':id/roles')
  // @CheckAbilities({ action: 'manage', subject: 'all' })
  @ApiOperation({ summary: 'Update user roles' })
  @ApiResponse({ status: 200, description: 'User roles updated successfully' })
  async updateRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserRolesDto: UpdateUserRolesDto,
  ) {
    return this.usersService.updateRoles(id, updateUserRolesDto.roleIds);
  }
}
