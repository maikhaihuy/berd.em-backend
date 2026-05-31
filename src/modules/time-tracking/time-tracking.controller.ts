import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TimeTrackingService } from './time-tracking.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { VerifyTimeLogDto } from './dto/verify-time-log.dto';
import { TimeLogResponseDto } from './dto/time-log-response.dto';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';

@ApiTags('time-tracking')
@Controller('time-tracking')
@UseGuards(JwtAccessGuard)
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

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
  ): Promise<TimeLogResponseDto> {
    // TODO: Get currentUserId from JWT token
    const currentUserId = 1; // Placeholder
    return this.timeTrackingService.create(createDto, currentUserId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all time logs' })
  @ApiResponse({
    status: 200,
    description: 'List of time logs',
    type: [TimeLogResponseDto],
  })
  async findAll(): Promise<TimeLogResponseDto[]> {
    return this.timeTrackingService.findAll();
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get time logs for an employee' })
  @ApiResponse({
    status: 200,
    description: 'List of time logs for the employee',
    type: [TimeLogResponseDto],
  })
  async findByEmployee(
    @Param('employeeId') employeeId: string,
  ): Promise<TimeLogResponseDto[]> {
    return this.timeTrackingService.findByEmployee(+employeeId);
  }

  @Get('assignment/:assignmentId')
  @ApiOperation({ summary: 'Get time logs for an assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of time logs for the assignment',
    type: [TimeLogResponseDto],
  })
  async findByAssignment(
    @Param('assignmentId') assignmentId: string,
  ): Promise<TimeLogResponseDto[]> {
    return this.timeTrackingService.findByAssignment(+assignmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get time log by ID' })
  @ApiResponse({
    status: 200,
    description: 'Time log found',
    type: TimeLogResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Time log not found' })
  async findOne(@Param('id') id: string): Promise<TimeLogResponseDto> {
    return this.timeTrackingService.findOne(+id);
  }

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
