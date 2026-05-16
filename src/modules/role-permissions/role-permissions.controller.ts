import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolePermissionsService } from './role-permissions.service';
import { AssignPermissionsDto } from './dto/assign-permission.dto';
import { RolePermissionResponseDto } from './dto/role-permission-response.dto';

@ApiTags('Role Permissions')
@Controller('role-permissions')
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Assign permissions to a role' })
  @ApiResponse({
    status: 201,
    description: 'Permissions assigned successfully',
    type: [RolePermissionResponseDto],
  })
  async assignPermissions(
    @Body() dto: AssignPermissionsDto,
  ): Promise<RolePermissionResponseDto[]> {
    return this.rolePermissionsService.assignPermissions(dto);
  }

  @Get('role/:roleId')
  @ApiOperation({ summary: 'Get all permissions for a role' })
  @ApiResponse({
    status: 200,
    description: 'Role permissions retrieved',
    type: [RolePermissionResponseDto],
  })
  async getRolePermissions(
    @Param('roleId', ParseIntPipe) roleId: number,
  ): Promise<RolePermissionResponseDto[]> {
    return this.rolePermissionsService.getRolePermissions(roleId);
  }

  @Delete('role/:roleId/permission/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a permission from a role' })
  @ApiResponse({ status: 204, description: 'Permission removed successfully' })
  async removePermission(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ): Promise<void> {
    return this.rolePermissionsService.removePermission(roleId, permissionId);
  }

  @Delete('role/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove all permissions from a role' })
  @ApiResponse({
    status: 204,
    description: 'All permissions removed successfully',
  })
  async removeAllRolePermissions(
    @Param('roleId', ParseIntPipe) roleId: number,
  ): Promise<void> {
    return this.rolePermissionsService.removeAllRolePermissions(roleId);
  }
}
