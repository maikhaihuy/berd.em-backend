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
} from '@nestjs/common';
import { RosterService } from './roster.service';
import { CreateRosterDto } from './dto/create-roster.dto';
import { UpdateRosterDto } from './dto/update-roster.dto';
import { RosterResponseDto } from './dto/roster-response.dto';

@Controller('rosters')
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post()
  async create(
    @Body() createRosterDto: CreateRosterDto,
    // TODO: Add authentication decorator to get current user
    // @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<RosterResponseDto> {
    // TODO: Replace with actual user ID from authentication
    const currentUserId = 1;
    return this.rosterService.create(createRosterDto, currentUserId);
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
    // TODO: Add authentication decorator to get current user
    // @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<RosterResponseDto> {
    // TODO: Replace with actual user ID from authentication
    const currentUserId = 1;
    return this.rosterService.update(id, updateRosterDto, currentUserId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.rosterService.remove(id);
  }
}
