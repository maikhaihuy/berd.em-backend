import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Post,
  Delete,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UsersService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AbilitiesService } from '@modules/abilities/abilities.service';
import { AbilityRuleDto } from '@modules/abilities/dto/ability-rule.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly abilitiesService: AbilitiesService,
  ) {}

  @RequirePermissions({ action: 'create', subject: 'users' })
  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'The user has been successfully created.',
    type: UserResponseDto,
  })
  @ApiBody({ type: CreateUserDto })
  async create(
    @Body() createUserDto: CreateUserDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return await this.usersService.create(createUserDto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'users' })
  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all users' })
  @ApiResponse({
    status: 200,
    description: 'A list of users.',
    type: [UserResponseDto],
  })
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @RequirePermissions({ action: 'read', subject: 'users' })
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a user by ID' })
  @ApiResponse({
    status: 200,
    description: 'The user found by ID.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return await this.usersService.findOne(+id);
  }

  @RequirePermissions({ action: 'read', subject: 'user-abilities' })
  @Get(':id/abilities')
  @ApiOperation({ summary: "Get a user's resolved abilities (admin)" })
  @ApiResponse({
    status: 200,
    description: "The target user's resolved ability rules",
    type: [AbilityRuleDto],
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUserAbilities(@Param('id') id: string): Promise<AbilityRuleDto[]> {
    return this.abilitiesService.getAbilitiesForUser(+id);
  }

  @RequirePermissions({ action: 'update', subject: 'users' })
  @Put(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully updated.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiBody({ type: UpdateUserDto })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return await this.usersService.update(+id, updateUserDto, user.userId);
  }

  // Note: Role update is now handled via PUT /users/:id with roleId field
  // since User now has single roleId instead of many-to-many relationship

  @RequirePermissions({ action: 'delete', subject: 'users' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiResponse({
    status: 204,
    description: 'The user has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(
    @Param('id') id: string,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<void> {
    await this.usersService.remove(+id, user.userId);
  }
}
