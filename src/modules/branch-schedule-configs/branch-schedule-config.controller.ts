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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { BranchScheduleConfigService } from './branch-schedule-config.service';
import { CreateBranchScheduleConfigDto } from './dto/create-branch-schedule-config.dto';
import { UpdateBranchScheduleConfigDto } from './dto/update-branch-schedule-config.dto';
import { BranchScheduleConfigResponseDto } from './dto/branch-schedule-config-response.dto';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { CaslAbility } from '@modules/auth/decorators/casl-ability.decorator';
import type { AppAbility } from '@modules/casl/casl-ability.factory';

@ApiTags('branch-schedule-configs')
@Controller('branch-schedule-configs')
export class BranchScheduleConfigsController {
  constructor(private readonly service: BranchScheduleConfigService) {}

  @RequirePermissions({ action: 'create', subject: 'branch-schedule-configs' })
  @Post()
  @ApiOperation({ summary: 'Create a branch schedule config' })
  @ApiResponse({ status: 201, type: BranchScheduleConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Branch already has a config' })
  @ApiBody({ type: CreateBranchScheduleConfigDto })
  async create(
    @Body() dto: CreateBranchScheduleConfigDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<BranchScheduleConfigResponseDto> {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'branch-schedule-configs' })
  @Get()
  @ApiOperation({ summary: 'List all branch schedule configs' })
  @ApiResponse({ status: 200, type: [BranchScheduleConfigResponseDto] })
  async findAll(
    @CaslAbility() ability: AppAbility,
  ): Promise<BranchScheduleConfigResponseDto[]> {
    return this.service.findAll(ability);
  }

  // Declared before ':id' so 'branch' is not captured as an id.
  @RequirePermissions({ action: 'read', subject: 'branch-schedule-configs' })
  @Get('branch/:branchId')
  @ApiOperation({ summary: 'Get the schedule config for a branch' })
  @ApiResponse({ status: 200, type: BranchScheduleConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Branch has no config' })
  async findByBranch(
    @Param('branchId', ParseIntPipe) branchId: number,
    @CaslAbility() ability: AppAbility,
  ): Promise<BranchScheduleConfigResponseDto> {
    return this.service.findByBranch(branchId, ability);
  }

  @RequirePermissions({ action: 'read', subject: 'branch-schedule-configs' })
  @Get(':id')
  @ApiOperation({ summary: 'Get a branch schedule config by ID' })
  @ApiResponse({ status: 200, type: BranchScheduleConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CaslAbility() ability: AppAbility,
  ): Promise<BranchScheduleConfigResponseDto> {
    return this.service.findOne(id, ability);
  }

  @RequirePermissions({ action: 'update', subject: 'branch-schedule-configs' })
  @Patch(':id')
  @ApiOperation({ summary: 'Update a branch schedule config' })
  @ApiResponse({ status: 200, type: BranchScheduleConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Config not found' })
  @ApiBody({ type: UpdateBranchScheduleConfigDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBranchScheduleConfigDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<BranchScheduleConfigResponseDto> {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'branch-schedule-configs' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a branch schedule config' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Config not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }
}
