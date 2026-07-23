import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import { EmployeeHourlyRatesService } from './employee-hourly-rates.service';
import { CreateEmployeeHourlyRateDto } from './dto/create-employee-hourly-rate.dto';
import { UpdateEmployeeHourlyRateDto } from './dto/update-employee-hourly-rate.dto';
import { EmployeeHourlyRateResponseDto } from './dto/employee-hourly-rate-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';

@ApiTags('employee-hourly-rates')
@Controller('employee-hourly-rates')
export class EmployeeHourlyRatesController {
  constructor(
    private readonly employeeHourlyRatesService: EmployeeHourlyRatesService,
  ) {}

  @RequirePermissions({ action: 'create', subject: 'employee-hourly-rates' })
  @Post()
  @ApiOperation({ summary: 'Create a new employee hourly rate' })
  @ApiResponse({
    status: 201,
    description: 'The hourly rate has been successfully created.',
    type: EmployeeHourlyRateResponseDto,
  })
  @ApiBody({ type: CreateEmployeeHourlyRateDto })
  async create(
    @Body() createEmployeeHourlyRateDto: CreateEmployeeHourlyRateDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<EmployeeHourlyRateResponseDto> {
    return await this.employeeHourlyRatesService.create(
      createEmployeeHourlyRateDto,
      currentUser.userId,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'employee-hourly-rates' })
  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all employee hourly rates' })
  @ApiResponse({
    status: 200,
    description: 'A list of hourly rates.',
    type: [EmployeeHourlyRateResponseDto],
  })
  async findAll(): Promise<EmployeeHourlyRateResponseDto[]> {
    return await this.employeeHourlyRatesService.findAll();
  }

  @RequirePermissions({ action: 'read', subject: 'employee-hourly-rates' })
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an employee hourly rate by ID' })
  @ApiResponse({
    status: 200,
    description: 'The hourly rate found by ID.',
    type: EmployeeHourlyRateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Hourly rate not found.' })
  async findOne(
    @Param('id') id: string,
  ): Promise<EmployeeHourlyRateResponseDto> {
    return await this.employeeHourlyRatesService.findOne(+id);
  }

  @RequirePermissions({ action: 'update', subject: 'employee-hourly-rates' })
  @Put(':id')
  @ApiOperation({ summary: 'Update an employee hourly rate by ID' })
  @ApiResponse({
    status: 200,
    description: 'The hourly rate has been successfully updated.',
    type: EmployeeHourlyRateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Hourly rate not found.' })
  @ApiBody({ type: UpdateEmployeeHourlyRateDto })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeHourlyRateDto: UpdateEmployeeHourlyRateDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<EmployeeHourlyRateResponseDto> {
    return await this.employeeHourlyRatesService.update(
      +id,
      updateEmployeeHourlyRateDto,
      currentUser.userId,
    );
  }

  @RequirePermissions({ action: 'delete', subject: 'employee-hourly-rates' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an employee hourly rate by ID' })
  @ApiResponse({
    status: 204,
    description: 'The hourly rate has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Hourly rate not found.' })
  async remove(
    @Param('id') id: string,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<void> {
    await this.employeeHourlyRatesService.remove(+id, currentUser.userId);
  }
}
