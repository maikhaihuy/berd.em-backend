import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PayrollEntryService } from './payroll-entry.service';
import { GeneratePayrollEntriesDto } from './dto/generate-payroll-entries.dto';
import {
  PayrollEntryResponseDto,
  GeneratePayrollEntriesResultDto,
} from './dto/payroll-entry-response.dto';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { CaslAbility } from '@modules/auth/decorators/casl-ability.decorator';
import type { AppAbility } from '@modules/casl/casl-ability.factory';

@ApiTags('payroll-entries')
@Controller('payroll-entries')
export class PayrollEntriesController {
  constructor(private readonly payrollEntryService: PayrollEntryService) {}

  @RequirePermissions({ action: 'generate', subject: 'payroll-entries' })
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate payroll entries from verified time logs in a pay period',
  })
  @ApiResponse({ status: 201, type: GeneratePayrollEntriesResultDto })
  @ApiResponse({ status: 404, description: 'Pay period not found' })
  @ApiBody({ type: GeneratePayrollEntriesDto })
  async generate(
    @Body() dto: GeneratePayrollEntriesDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<GeneratePayrollEntriesResultDto> {
    return this.payrollEntryService.generate(dto.payPeriodId, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'payroll-entries' })
  @Get()
  @ApiOperation({
    summary:
      'List payroll entries, optionally filtered by pay period or employee',
  })
  @ApiResponse({ status: 200, type: [PayrollEntryResponseDto] })
  async findAll(
    @CaslAbility() ability: AppAbility,
    @Query('payPeriodId') payPeriodId?: string,
    @Query('employeeId') employeeId?: string,
  ): Promise<PayrollEntryResponseDto[]> {
    return this.payrollEntryService.findAll(
      payPeriodId ? +payPeriodId : undefined,
      employeeId ? +employeeId : undefined,
      ability,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'payroll-entries' })
  @Get(':id')
  @ApiOperation({ summary: 'Get a payroll entry by ID' })
  @ApiResponse({ status: 200, type: PayrollEntryResponseDto })
  @ApiResponse({ status: 404, description: 'Payroll entry not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CaslAbility() ability: AppAbility,
  ): Promise<PayrollEntryResponseDto> {
    return this.payrollEntryService.findOne(id, ability);
  }

  @RequirePermissions({ action: 'delete', subject: 'payroll-entries' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a payroll entry' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Payroll entry not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.payrollEntryService.remove(id);
  }
}
