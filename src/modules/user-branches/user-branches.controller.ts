import {
  Controller,
  Post,
  Delete,
  Get,
  Put,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserBranchesService } from './user-branches.service';
import { AssignBranchesDto } from './dto/assign-branch.dto';
import { UpdatePrimaryBranchDto } from './dto/update-primary-branch.dto';
import { UserBranchResponseDto } from './dto/user-branch-response.dto';

@ApiTags('User Branches')
@Controller('user-branches')
export class UserBranchesController {
  constructor(private readonly userBranchesService: UserBranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Assign branches to a user' })
  @ApiResponse({
    status: 201,
    description: 'Branches assigned successfully',
    type: [UserBranchResponseDto],
  })
  async assignBranches(
    @Body() dto: AssignBranchesDto,
  ): Promise<UserBranchResponseDto[]> {
    return this.userBranchesService.assignBranches(dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all branches for a user' })
  @ApiResponse({
    status: 200,
    description: 'User branches retrieved',
    type: [UserBranchResponseDto],
  })
  async getUserBranches(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserBranchResponseDto[]> {
    return this.userBranchesService.getUserBranches(userId);
  }

  @Put('user/:userId/primary')
  @ApiOperation({ summary: 'Update primary branch for a user' })
  @ApiResponse({
    status: 200,
    description: 'Primary branch updated',
    type: UserBranchResponseDto,
  })
  async updatePrimaryBranch(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdatePrimaryBranchDto,
  ): Promise<UserBranchResponseDto> {
    return this.userBranchesService.updatePrimaryBranch(userId, dto);
  }

  @Delete('user/:userId/branch/:branchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a branch from a user' })
  @ApiResponse({ status: 204, description: 'Branch removed successfully' })
  async removeBranch(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('branchId', ParseIntPipe) branchId: number,
  ): Promise<void> {
    return this.userBranchesService.removeBranch(userId, branchId);
  }

  @Delete('user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove all branches from a user' })
  @ApiResponse({
    status: 204,
    description: 'All branches removed successfully',
  })
  async removeAllUserBranches(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    return this.userBranchesService.removeAllUserBranches(userId);
  }
}
