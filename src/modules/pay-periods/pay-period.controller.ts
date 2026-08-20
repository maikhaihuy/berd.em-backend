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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PayPeriodService } from './pay-period.service';
import { CreatePayPeriodDto } from './dto/create-pay-period.dto';
import { UpdatePayPeriodDto } from './dto/update-pay-period.dto';
import { PayPeriodResponseDto } from './dto/pay-period-response.dto';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';

@ApiTags('pay-periods')
@Controller('pay-periods')
export class PayPeriodsController {
  constructor(private readonly payPeriodService: PayPeriodService) {}

  @RequirePermissions({ action: 'create', subject: 'pay-periods' })
  @Post()
  @ApiOperation({ summary: 'Create a new pay period (status OPEN)' })
  @ApiResponse({ status: 201, type: PayPeriodResponseDto })
  @ApiBody({ type: CreatePayPeriodDto })
  async create(
    @Body() dto: CreatePayPeriodDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<PayPeriodResponseDto> {
    return this.payPeriodService.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'pay-periods' })
  @Get()
  @ApiOperation({ summary: 'List all pay periods' })
  @ApiResponse({ status: 200, type: [PayPeriodResponseDto] })
  async findAll(): Promise<PayPeriodResponseDto[]> {
    return this.payPeriodService.findAll();
  }

  @RequirePermissions({ action: 'read', subject: 'pay-periods' })
  @Get(':id')
  @ApiOperation({ summary: 'Get a pay period by ID' })
  @ApiResponse({ status: 200, type: PayPeriodResponseDto })
  @ApiResponse({ status: 404, description: 'Pay period not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PayPeriodResponseDto> {
    return this.payPeriodService.findOne(id);
  }

  @RequirePermissions({ action: 'update', subject: 'pay-periods' })
  @Patch(':id')
  @ApiOperation({ summary: 'Update a pay period' })
  @ApiResponse({ status: 200, type: PayPeriodResponseDto })
  @ApiResponse({ status: 404, description: 'Pay period not found' })
  @ApiBody({ type: UpdatePayPeriodDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayPeriodDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<PayPeriodResponseDto> {
    return this.payPeriodService.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'pay-periods' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a pay period' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Pay period not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.payPeriodService.remove(id);
  }

  @RequirePermissions({ action: 'close', subject: 'pay-periods' })
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a pay period (OPEN -> CLOSED)' })
  @ApiResponse({ status: 200, type: PayPeriodResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  async close(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<PayPeriodResponseDto> {
    return this.payPeriodService.close(id, user.userId);
  }

  @RequirePermissions({ action: 'finalize', subject: 'pay-periods' })
  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize a pay period (CLOSED -> FINALIZED)' })
  @ApiResponse({ status: 200, type: PayPeriodResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  async finalize(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<PayPeriodResponseDto> {
    return this.payPeriodService.finalize(id, user.userId);
  }
}
