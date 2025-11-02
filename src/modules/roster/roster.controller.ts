import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { RosterService } from './roster.service';
import { CreateRosterDto } from './dto/create-roster.dto';
import { UpdateRosterDto } from './dto/update-roster.dto';
import { RosterResponseDto } from './dto/roster-response.dto';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('rosters')
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post()
  async create(
    @Body() createRosterDto: CreateRosterDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<RosterResponseDto> {
    return this.rosterService.create(createRosterDto, currentUser.id);
  }

  @Get()
  async findAll(
    @Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number,
    @Query('date') date?: string,
  ): Promise<RosterResponseDto[]> {
    return this.rosterService.findAll(branchId, date);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RosterResponseDto> {
    return this.rosterService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRosterDto: UpdateRosterDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<RosterResponseDto> {
    return this.rosterService.update(id, updateRosterDto, currentUser.id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.rosterService.remove(id);
  }

  @Put(':id/schedule')
  @ApiOperation({ summary: 'Schedule a roster' })
  @ApiResponse({
    status: 200,
    description: 'Roster updated successfully',
    type: RosterResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Roster not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  schedule(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<RosterResponseDto> {
    return this.rosterService.schedule(id, currentUser.id);
  }

  @Put(':id/unschedule')
  @ApiOperation({ summary: 'Unschedule a roster' })
  @ApiResponse({
    status: 200,
    description: 'Roster updated successfully',
    type: RosterResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Roster not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  unpublish(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<RosterResponseDto> {
    return this.rosterService.unschedule(id, currentUser.id);
  }
}
