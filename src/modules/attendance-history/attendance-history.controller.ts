import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AttendanceHistoryService } from './attendance-history.service';
import { CreateAttendanceHistoryDto } from './dto/create-attendance-history.dto';
import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceHistoryFilterDto } from './dto/attendance-history-filter.dto';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';

@ApiTags('attendance-history')
@ApiBearerAuth()
@Controller('attendance-history')
export class AttendanceHistoryController {
  constructor(
    private readonly attendanceHistoryService: AttendanceHistoryService,
  ) {}

  @RequirePermissions({ action: 'create', subject: 'attendance-history' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create attendance history record' })
  @ApiResponse({
    status: 201,
    description: 'Attendance history record created successfully',
    type: AttendanceHistoryResponseDto,
  })
  @ApiBody({ type: CreateAttendanceHistoryDto })
  async create(
    @Body() createDto: CreateAttendanceHistoryDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<AttendanceHistoryResponseDto> {
    return this.attendanceHistoryService.create(createDto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'attendance-history' })
  @Get('assignment/:assignmentId')
  @ApiOperation({ summary: 'Get all attendance history for an assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of attendance history records for assignment',
    type: [AttendanceHistoryResponseDto],
  })
  async findByAssignment(
    @Param('assignmentId') assignmentId: string,
  ): Promise<AttendanceHistoryResponseDto[]> {
    return this.attendanceHistoryService.findByAssignment(+assignmentId);
  }

  @RequirePermissions({ action: 'read', subject: 'attendance-history' })
  @Get(':id')
  @ApiOperation({ summary: 'Get attendance history record by ID' })
  @ApiResponse({
    status: 200,
    description: 'Attendance history record found',
    type: AttendanceHistoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Attendance history not found' })
  async findOne(
    @Param('id') id: string,
  ): Promise<AttendanceHistoryResponseDto> {
    return this.attendanceHistoryService.findOne(+id);
  }

  @RequirePermissions({ action: 'read', subject: 'attendance-history' })
  @Get()
  @ApiOperation({ summary: 'Get all attendance history records with filters' })
  @ApiResponse({
    status: 200,
    description: 'List of attendance history records',
    type: [AttendanceHistoryResponseDto],
  })
  async findAll(
    @Query() filterDto: AttendanceHistoryFilterDto,
  ): Promise<AttendanceHistoryResponseDto[]> {
    return this.attendanceHistoryService.findAll(filterDto);
  }

  // Note: No update or delete endpoints - attendance history is immutable for audit integrity
}
