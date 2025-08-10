import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  // UsePipes,
  // ValidationPipe,
  // Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoleResponseDto } from './dto/role-response.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({
    status: 201,
    description: 'The role has been successfully created.',
    type: RoleResponseDto,
  })
  @ApiBody({ type: CreateRoleDto })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const currentUserId = 1;
    return await this.rolesService.create(createRoleDto, currentUserId);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all roles with pagination' })
  @ApiResponse({ status: 200, description: 'A list of roles.' })
  // @UsePipes(new ValidationPipe({ transform: true }))
  async findAll() {
    // const { page, limit } = paginationDto;
    return await this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a role by ID' })
  @ApiResponse({
    status: 200,
    description: 'The role found by ID.',
    type: RoleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  async findOne(@Param('id') id: string) {
    return await this.rolesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role by ID' })
  @ApiResponse({
    status: 200,
    description: 'The role has been successfully updated.',
    type: RoleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  @ApiBody({ type: UpdateRoleDto })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return await this.rolesService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role by ID' })
  @ApiResponse({
    status: 204,
    description: 'The role has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  async remove(@Param('id') id: string) {
    await this.rolesService.remove(+id);
  }
}
