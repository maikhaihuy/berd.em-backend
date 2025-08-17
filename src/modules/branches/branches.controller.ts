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
  Put,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';
import { ShiftResponseDto } from '@modules/shifts/dto/shift-response.dto';
import { UpsertShiftDto } from '@modules/shifts/dto/upsert-shift.dto';

@ApiTags('branches')
@UseGuards(JwtAccessGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiResponse({
    status: 201,
    description: 'The branch has been successfully created.',
    type: BranchResponseDto,
  })
  @ApiBody({ type: CreateBranchDto })
  async create(
    @Body() createBranchDto: CreateBranchDto,
  ): Promise<BranchResponseDto> {
    return await this.branchesService.create(createBranchDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all branches' })
  @ApiResponse({
    status: 200,
    description: 'A list of branches.',
    type: [BranchResponseDto],
  })
  async findAll(): Promise<BranchResponseDto[]> {
    return await this.branchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a branch by ID' })
  @ApiResponse({
    status: 200,
    description: 'The branch found by ID.',
    type: BranchResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async findOne(@Param('id') id: string): Promise<BranchResponseDto> {
    return await this.branchesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a branch by ID' })
  @ApiResponse({
    status: 200,
    description: 'The branch has been successfully updated.',
    type: BranchResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  @ApiBody({ type: UpdateBranchDto })
  async update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return await this.branchesService.update(+id, updateBranchDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a branch by ID' })
  @ApiResponse({
    status: 204,
    description: 'The branch has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Branch not found.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.branchesService.remove(+id);
  }

  @Put(':id/shifts')
  @ApiOperation({
    summary:
      'Synchronize shifts for a specified branch (create, update, and delete)',
  })
  @ApiResponse({
    status: 200,
    description: 'Shifts have been successfully synchronized.',
    type: [ShiftResponseDto],
  })
  @ApiBody({ type: [UpsertShiftDto] })
  async syncShifts(
    @Param('id') branchId: string,
    @Body() shiftsDto: UpsertShiftDto[],
  ): Promise<ShiftResponseDto[]> {
    return await this.branchesService.syncShifts(+branchId, shiftsDto);
  }
}
