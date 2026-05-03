import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AttendanceHistoryService } from './attendance-history.service';
import { CreateAttendanceHistoryDto } from './dto/create-attendance-history.dto';
import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceHistoryFilterDto } from './dto/attendance-history-filter.dto';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';

@ApiTags('attendance-history')
@Controller('attendance-history')
@UseGuards(JwtAccessGuard)
export class AttendanceHistoryController {
  constructor(
    private readonly attendanceHistoryService: AttendanceHistoryService,
  ) {}

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
  ): Promise<AttendanceHistoryResponseDto> {
    // TODO: Get currentUserId from JWT token
    const currentUserId = 1; // Placeholder
    return this.attendanceHistoryService.create(createDto, currentUserId);
  }

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

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance history record by ID' })
  @ApiResponse({
    status: 200,
    description: 'Attendance history record found',
    type: AttendanceHistoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Attendance history not found' })
  async findOne(@Param('id') id: string): Promise<AttendanceHistoryResponseDto> {
    return this.attendanceHistoryService.findOne(+id);
  }

  @Get('work-slot/:workSlotId')
  @ApiOperation({ summary: 'Get all attendance history for a work slot' })
  @ApiResponse({
    status: 200,
    description: 'List of attendance history records for work slot',
    type: [AttendanceHistoryResponseDto],
  })
  async findByWorkSlot(
    @Param('workSlotId') workSlotId: string,
  ): Promise<AttendanceHistoryResponseDto[]> {
    return this.attendanceHistoryService.findByWorkSlot(+workSlotId);
  }

  // Note: No update or delete endpoints - attendance history is immutable for audit integrity
}
