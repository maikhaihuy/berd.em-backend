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
  UseGuards,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftResponseDto } from './dto/shift-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';

@ApiTags('shifts')
@UseGuards(JwtAccessGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiResponse({
    status: 201,
    description: 'The shift has been successfully created.',
    type: ShiftResponseDto,
  })
  @ApiBody({ type: CreateShiftDto })
  async create(
    @Body() createShiftDto: CreateShiftDto,
  ): Promise<ShiftResponseDto> {
    return await this.shiftsService.create(createShiftDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all shifts' })
  @ApiResponse({
    status: 200,
    description: 'A list of shifts.',
    type: [ShiftResponseDto],
  })
  async findAll(): Promise<ShiftResponseDto[]> {
    return await this.shiftsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a shift by ID' })
  @ApiResponse({
    status: 200,
    description: 'The shift found by ID.',
    type: ShiftResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Shift not found.' })
  async findOne(@Param('id') id: string): Promise<ShiftResponseDto> {
    return await this.shiftsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shift by ID' })
  @ApiResponse({
    status: 200,
    description: 'The shift has been successfully updated.',
    type: ShiftResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Shift not found.' })
  @ApiBody({ type: UpdateShiftDto })
  async update(
    @Param('id') id: string,
    @Body() updateShiftDto: UpdateShiftDto,
  ): Promise<ShiftResponseDto> {
    return await this.shiftsService.update(+id, updateShiftDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shift by ID' })
  @ApiResponse({
    status: 204,
    description: 'The shift has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Shift not found.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.shiftsService.remove(+id);
  }
}
