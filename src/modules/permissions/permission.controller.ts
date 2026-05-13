import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PermissionsService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({
    status: 201,
    description: 'The permission has been successfully created.',
    type: PermissionResponseDto,
  })
  @ApiBody({ type: CreatePermissionDto })
  async create(
    @Body() createPermissionDto: CreatePermissionDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    return await this.permissionsService.create(
      createPermissionDto,
      currentUser.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all permissions' })
  @ApiResponse({
    status: 200,
    description: 'A list of permissions.',
    type: [PermissionResponseDto],
  })
  async findAll() {
    return await this.permissionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a permission by ID' })
  @ApiResponse({
    status: 200,
    description: 'The permission found by ID.',
    type: PermissionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Permission not found.' })
  async findOne(@Param('id') id: string) {
    return await this.permissionsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a permission by ID' })
  @ApiResponse({
    status: 200,
    description: 'The permission has been successfully updated.',
    type: PermissionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Permission not found.' })
  @ApiBody({ type: UpdatePermissionDto })
  async update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    return await this.permissionsService.update(
      +id,
      updatePermissionDto,
      currentUser.userId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a permission by ID' })
  @ApiResponse({
    status: 204,
    description: 'The permission has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Permission not found.' })
  async remove(
    @Param('id') id: string,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    await this.permissionsService.remove(+id, currentUser.userId);
  }
}
