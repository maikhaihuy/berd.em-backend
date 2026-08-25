import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TimeTrackingService } from './time-tracking.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { VerifyTimeLogDto } from './dto/verify-time-log.dto';
import { TimeLogResponseDto } from './dto/time-log-response.dto';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { CaslAbility } from '@modules/auth/decorators/casl-ability.decorator';
import type { AppAbility } from '@modules/casl/casl-ability.factory';

@ApiTags('time-tracking')
@Controller('time-tracking')
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @RequirePermissions({ action: 'create', subject: 'time-logs' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new time log' })
  @ApiResponse({
    status: 201,
    description: 'Time log created successfully',
    type: TimeLogResponseDto,
  })
  @ApiBody({ type: CreateTimeLogDto })
  async create(
    @Body() createDto: CreateTimeLogDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
    @CaslAbility() ability: AppAbility,
  ): Promise<TimeLogResponseDto> {
    return this.timeTrackingService.create(
      createDto,
      user.userId,
      ability,
      user.employeeId,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'time-logs' })
  @Get()
  @ApiOperation({ summary: 'Get all time logs' })
  @ApiResponse({
    status: 200,
    description: 'List of time logs',
    type: [TimeLogResponseDto],
  })
  async findAll(
    @CaslAbility() ability: AppAbility,
  ): Promise<TimeLogResponseDto[]> {
    return this.timeTrackingService.findAll(ability);
  }

  @RequirePermissions({ action: 'read', subject: 'time-logs' })
  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get time logs for an employee' })
  @ApiResponse({
    status: 200,
    description: 'List of time logs for the employee',
    type: [TimeLogResponseDto],
  })
  async findByEmployee(
    @Param('employeeId') employeeId: string,
    @CaslAbility() ability: AppAbility,
  ): Promise<TimeLogResponseDto[]> {
    return this.timeTrackingService.findByEmployee(+employeeId, ability);
  }

  @RequirePermissions({ action: 'read', subject: 'time-logs' })
  @Get('assignment/:assignmentId')
  @ApiOperation({ summary: 'Get time logs for an assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of time logs for the assignment',
    type: [TimeLogResponseDto],
  })
  async findByAssignment(
    @Param('assignmentId') assignmentId: string,
    @CaslAbility() ability: AppAbility,
  ): Promise<TimeLogResponseDto[]> {
    return this.timeTrackingService.findByAssignment(+assignmentId, ability);
  }

  @RequirePermissions({ action: 'read', subject: 'time-logs' })
  @Get(':id')
  @ApiOperation({ summary: 'Get time log by ID' })
  @ApiResponse({
    status: 200,
    description: 'Time log found',
    type: TimeLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Time log not found' })
  async findOne(
    @Param('id') id: string,
    @CaslAbility() ability: AppAbility,
  ): Promise<TimeLogResponseDto> {
    return this.timeTrackingService.findOne(+id, ability);
  }

  @RequirePermissions({ action: 'update', subject: 'time-logs' })
  @Put(':id')
  @ApiOperation({ summary: 'Update a time log' })
  @ApiResponse({
    status: 200,
    description: 'Time log updated successfully',
    type: TimeLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Time log not found' })
  @ApiBody({ type: UpdateTimeLogDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTimeLogDto,
  ): Promise<TimeLogResponseDto> {
    // TODO: Get currentUserId from JWT token
    const currentUserId = 1; // Placeholder
    return this.timeTrackingService.update(+id, updateDto, currentUserId);
  }

  @RequirePermissions({ action: 'verify', subject: 'time-logs' })
  @Put(':id/verify')
  @ApiOperation({ summary: 'Verify or reject a time log' })
  @ApiResponse({
    status: 200,
    description: 'Time log verified/rejected successfully',
    type: TimeLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Time log not found' })
  @ApiBody({ type: VerifyTimeLogDto })
  async verify(
    @Param('id') id: string,
    @Body() verifyDto: VerifyTimeLogDto,
  ): Promise<TimeLogResponseDto> {
    // TODO: Get verifierId from JWT token (manager/supervisor)
    const verifierId = 1; // Placeholder
    return this.timeTrackingService.verify(+id, verifyDto, verifierId);
  }

  @RequirePermissions({ action: 'delete', subject: 'time-logs' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a time log' })
  @ApiResponse({
    status: 204,
    description: 'Time log deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Time log not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.timeTrackingService.remove(+id);
  }
}
