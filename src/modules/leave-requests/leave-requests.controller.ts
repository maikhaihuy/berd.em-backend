import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveRequestDto } from './dto/approve-leave-request.dto';
import { LeaveRequestResponseDto } from './dto/leave-request-response.dto';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { LeaveStatus } from '@prisma/client';

@ApiTags('leave-requests')
@Controller('leave-requests')
@UseGuards(JwtAccessGuard)
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new leave request' })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully',
    type: LeaveRequestResponseDto,
  })
  @ApiBody({ type: CreateLeaveRequestDto })
  async create(
    @Body() createDto: CreateLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    // TODO: Get currentUserId from JWT token
    const currentUserId = 1; // Placeholder
    return this.leaveRequestsService.create(createDto, currentUserId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leave requests' })
  @ApiResponse({
    status: 200,
    description: 'List of leave requests',
    type: [LeaveRequestResponseDto],
  })
  async findAll(): Promise<LeaveRequestResponseDto[]> {
    return this.leaveRequestsService.findAll();
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get leave requests by status' })
  @ApiResponse({
    status: 200,
    description: 'List of leave requests with specified status',
    type: [LeaveRequestResponseDto],
  })
  async findByStatus(
    @Param('status') status: LeaveStatus,
  ): Promise<LeaveRequestResponseDto[]> {
    return this.leaveRequestsService.findByStatus(status);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get leave requests for an employee' })
  @ApiResponse({
    status: 200,
    description: 'List of leave requests for the employee',
    type: [LeaveRequestResponseDto],
  })
  async findByEmployee(
    @Param('employeeId') employeeId: string,
  ): Promise<LeaveRequestResponseDto[]> {
    return this.leaveRequestsService.findByEmployee(+employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request found',
    type: LeaveRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async findOne(@Param('id') id: string): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a leave request' })
  @ApiResponse({
    status: 200,
    description: 'Leave request updated successfully',
    type: LeaveRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiBody({ type: UpdateLeaveRequestDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    // TODO: Get currentUserId from JWT token
    const currentUserId = 1; // Placeholder
    return this.leaveRequestsService.update(+id, updateDto, currentUserId);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  @ApiResponse({
    status: 200,
    description: 'Leave request approved/rejected successfully',
    type: LeaveRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiBody({ type: ApproveLeaveRequestDto })
  async approve(
    @Param('id') id: string,
    @Body() approveDto: ApproveLeaveRequestDto,
  ): Promise<LeaveRequestResponseDto> {
    // TODO: Get currentUserId from JWT token (manager/admin)
    const currentUserId = 1; // Placeholder
    return this.leaveRequestsService.approve(+id, approveDto, currentUserId);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiResponse({
    status: 200,
    description: 'Leave request cancelled successfully',
    type: LeaveRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async cancel(@Param('id') id: string): Promise<LeaveRequestResponseDto> {
    // TODO: Get currentUserId from JWT token
    const currentUserId = 1; // Placeholder
    return this.leaveRequestsService.cancel(+id, currentUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a leave request' })
  @ApiResponse({
    status: 204,
    description: 'Leave request deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.leaveRequestsService.remove(+id);
  }
}
