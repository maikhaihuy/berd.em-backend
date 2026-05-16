import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WorkSlotsService } from './work-slot.service';
import { CreateWorkSlotDto } from './dto/create-work-slot.dto';
import { UpdateWorkSlotDto } from './dto/update-work-slot.dto';
import { WorkSlotResponseDto } from './dto/work-slot-response.dto';
import { BulkCreateWorkSlotDto } from './dto/bulk-create-work-slot.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { WorkSlotFilterDto } from './dto/work-slot-filter.dto';
import {
  ConflictCheckDto,
  ConflictResponseDto,
} from './dto/conflict-check.dto';

@ApiTags('work-slots')
@Controller('work-slots')
export class WorkSlotsController {
  constructor(private readonly workSlotsService: WorkSlotsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new work slot' })
  @ApiResponse({
    status: 201,
    description: 'Work slot created successfully',
    type: WorkSlotResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 404, description: 'Branch or employee not found' })
  @ApiResponse({ status: 409, description: 'Scheduling conflict detected' })
  create(
    @Body() createWorkSlotDto: CreateWorkSlotDto,
  ): Promise<WorkSlotResponseDto> {
    return this.workSlotsService.create(createWorkSlotDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create work slots' })
  @ApiResponse({
    status: 201,
    description: 'Work slots created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 404, description: 'Branch or employee not found' })
  @ApiResponse({ status: 409, description: 'Scheduling conflict detected' })
  bulkCreate(
    @Body() bulkCreateWorkSlotDto: BulkCreateWorkSlotDto,
  ): Promise<{ created: number; workSlots: WorkSlotResponseDto[] }> {
    return this.workSlotsService.bulkCreate(bulkCreateWorkSlotDto);
  }

  @Post('check-conflicts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check for scheduling conflicts' })
  @ApiResponse({
    status: 200,
    description: 'Conflict check completed',
    type: ConflictResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  checkConflicts(
    @Body() conflictCheckDto: ConflictCheckDto,
  ): Promise<ConflictResponseDto> {
    return this.workSlotsService.checkConflicts(conflictCheckDto);
  }

  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check in to a work slot' })
  @ApiResponse({
    status: 200,
    description: 'Checked in successfully',
    type: WorkSlotResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid status' })
  @ApiResponse({ status: 404, description: 'Work slot not found' })
  checkIn(
    @Param('id', ParseIntPipe) id: number,
    @Body() checkInDto: CheckInDto,
  ): Promise<WorkSlotResponseDto> {
    return this.workSlotsService.checkIn(id, checkInDto);
  }

  @Post(':id/check-out')
  @ApiOperation({ summary: 'Check out from a work slot' })
  @ApiResponse({
    status: 200,
    description: 'Checked out successfully',
    type: WorkSlotResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid status' })
  @ApiResponse({ status: 404, description: 'Work slot not found' })
  checkOut(
    @Param('id', ParseIntPipe) id: number,
    @Body() checkOutDto: CheckOutDto,
  ): Promise<WorkSlotResponseDto> {
    return this.workSlotsService.checkOut(id, checkOutDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all work slots with filters and pagination' })
  @ApiQuery({ name: 'branchId', required: false, type: Number })
  @ApiQuery({ name: 'employeeId', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT'],
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Work slots retrieved successfully',
  })
  findAll(@Query() filter: WorkSlotFilterDto): Promise<{
    data: WorkSlotResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.workSlotsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single work slot by ID' })
  @ApiResponse({
    status: 200,
    description: 'Work slot retrieved successfully',
    type: WorkSlotResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Work slot not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<WorkSlotResponseDto> {
    return this.workSlotsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a work slot' })
  @ApiResponse({
    status: 200,
    description: 'Work slot updated successfully',
    type: WorkSlotResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({
    status: 404,
    description: 'Work slot, branch, or employee not found',
  })
  @ApiResponse({ status: 409, description: 'Scheduling conflict detected' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkSlotDto: UpdateWorkSlotDto,
  ): Promise<WorkSlotResponseDto> {
    return this.workSlotsService.update(id, updateWorkSlotDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a work slot' })
  @ApiResponse({
    status: 200,
    description: 'Work slot deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete work slot in progress or completed',
  })
  @ApiResponse({ status: 404, description: 'Work slot not found' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.workSlotsService.remove(id);
  }
}
