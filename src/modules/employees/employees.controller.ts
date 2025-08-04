import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { AbilitiesGuard } from '../../common/guards/abilities.guard';
// import { CheckAbilities } from '../../common/decorators/abilities.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { User } from '@prisma/client';

@ApiTags('employees')
@Controller('employees')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  // @CheckAbilities({ action: 'create', subject: 'Employee' })
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: User,
  ) {
    return this.employeesService.create({
      ...createEmployeeDto,
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  @Get()
  // @CheckAbilities({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'Get all employees' })
  @ApiResponse({ status: 200, description: 'Returns all employees' })
  async findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  // @CheckAbilities({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiResponse({ status: 200, description: 'Returns the employee' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Put(':id')
  // @CheckAbilities({ action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'Update employee' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    return this.employeesService.update(id, {
      ...updateEmployeeDto,
      updatedBy: user.id,
    });
  }

  @Delete(':id')
  // @CheckAbilities({ action: 'delete', subject: 'Employee' })
  @ApiOperation({ summary: 'Delete employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.remove(id);
  }
}
