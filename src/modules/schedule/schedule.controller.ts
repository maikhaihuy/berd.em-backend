import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { getStartAndEndInWeek } from '@common/helpers/date.helper';

@ApiTags('schedules')
@Controller('schedules')
@UseGuards(JwtAccessGuard)
@ApiBearerAuth()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiResponse({
    status: 201,
    description: 'Schedule created successfully',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(
    @Body() createScheduleDto: CreateScheduleDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<ScheduleResponseDto> {
    return this.scheduleService.create(createScheduleDto, currentUser.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedules' })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    type: [ScheduleResponseDto],
  })
  async findAll(
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
    @Query('branchId') branchId: number,
    @Query('date') date?: string,
  ): Promise<ScheduleResponseDto[]> {
    const passedDate = date ? new Date(date) : new Date();
    const { start, end } = getStartAndEndInWeek(new Date(passedDate));
    return this.scheduleService.findAll(currentUser.id, branchId, start, end);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiResponse({
    status: 200,
    description: 'Schedule retrieved successfully',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<ScheduleResponseDto> {
    return this.scheduleService.findOne(id, currentUser.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiResponse({
    status: 200,
    description: 'Schedule updated successfully',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<ScheduleResponseDto> {
    return this.scheduleService.update(id, updateScheduleDto, currentUser.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiResponse({
    status: 200,
    description: 'Schedule deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<{ message: string }> {
    return this.scheduleService.remove(id, currentUser.id);
  }
}
