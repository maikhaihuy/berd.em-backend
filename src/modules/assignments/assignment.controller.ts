import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AssignmentsService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AssignmentCheckInDto } from './dto/check-in.dto';
import { AssignmentCheckOutDto } from './dto/check-out.dto';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @RequirePermissions({ action: 'create', subject: 'assignments' })
  @Post()
  create(
    @Body() dto: CreateAssignmentDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'assignments' })
  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('subShiftId') subShiftId?: string,
  ) {
    return this.service.findAll(
      employeeId ? Number(employeeId) : undefined,
      subShiftId ? Number(subShiftId) : undefined,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'assignments' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ action: 'update', subject: 'assignments' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssignmentDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'update', subject: 'assignments' })
  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check in to an assignment' })
  checkIn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignmentCheckInDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.checkIn(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'update', subject: 'assignments' })
  @Post(':id/check-out')
  @ApiOperation({ summary: 'Check out from an assignment' })
  checkOut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignmentCheckOutDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.checkOut(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'assignments' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
