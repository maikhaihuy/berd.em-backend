import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EmployeeHourlyRateResponseDto } from '@modules/employee-hourly-rates/dto/employee-hourly-rate-response.dto';
import { UpsertEmployeeHourlyRateDto } from '@modules/employee-hourly-rates/dto/upsert-employee-hourly-rate.dto';

@ApiTags('employees')
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a new employee with hourly rate and branches with hourly rate and branches',
  })
  @ApiResponse({
    status: 201,
    description: 'The employee has been successfully created.',
    type: EmployeeResponseDto,
  })
  @ApiBody({ type: CreateEmployeeDto })
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    return await this.employeesService.create(createEmployeeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve a list of all employees' })
  @ApiResponse({
    status: 200,
    description: 'A list of employees.',
    type: [EmployeeResponseDto],
  })
  async findAll(): Promise<EmployeeResponseDto[]> {
    return await this.employeesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an employee by ID' })
  @ApiResponse({
    status: 200,
    description: 'The employee found by ID.',
    type: EmployeeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async findOne(@Param('id') id: string): Promise<EmployeeResponseDto> {
    return await this.employeesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an employee by ID' })
  @ApiResponse({
    status: 200,
    description: 'The employee has been successfully updated.',
    type: EmployeeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  @ApiBody({ type: UpdateEmployeeDto })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    return await this.employeesService.update(+id, updateEmployeeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an employee by ID' })
  @ApiResponse({
    status: 204,
    description: 'The employee has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.employeesService.remove(+id);
  }

  @Post(':id/hourly-rates')
  @ApiOperation({ summary: 'Bulk upsert employee hourly rates' })
  @ApiResponse({
    status: 200,
    description: 'Hourly rates synchronized successfully.',
    type: [EmployeeHourlyRateResponseDto],
  })
  @ApiBody({ type: [UpsertEmployeeHourlyRateDto] })
  async syncHourlyRates(
    @Param('id') employeeId: string,
    @Body() ratesDto: UpsertEmployeeHourlyRateDto[],
  ): Promise<EmployeeHourlyRateResponseDto[]> {
    return await this.employeesService.syncHourlyRates(+employeeId, ratesDto);
  }
}
