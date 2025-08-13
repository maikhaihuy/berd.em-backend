import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  // UseGuards,
  Post,
  Delete,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { AbilitiesGuard } from '../../common/guards/abilities.guard';
// import { CheckAbilities } from '../../common/decorators/abilities.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'The user has been successfully created.',
    type: UserResponseDto,
  })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  @Get()
  // @CheckAbilities({ action: 'manage', subject: 'all' })
  @ApiOperation({ summary: 'Retrieve a list of all users' })
  @ApiResponse({
    status: 200,
    description: 'A list of users.',
    type: [UserResponseDto],
  })
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

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

  @Put(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully updated.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiBody({ type: UpdateUserDto })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.usersService.update(+id, updateUserDto);
  }

  @Put(':id/roles')
  // @CheckAbilities({ action: 'manage', subject: 'all' })
  @ApiOperation({ summary: "Update a user's roles" })
  @ApiResponse({
    status: 200,
    description: 'The user roles have been successfully updated.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User or role not found.' })
  @ApiBody({ type: UpdateUserRolesDto })
  async updateRoles(
    @Param('id') id: string,
    @Body() updateUserRolesDto: UpdateUserRolesDto,
  ): Promise<UserResponseDto> {
    return await this.usersService.updateRoles(+id, updateUserRolesDto.roleIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiResponse({
    status: 204,
    description: 'The user has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(+id);
  }
}
