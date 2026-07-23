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
import { CompleteTaskDto } from './dto/complete-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './task.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @RequirePermissions({ action: 'create', subject: 'tasks' })
  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'tasks' })
  @Get()
  findAll(
    @Query('masterShiftId') masterShiftId?: string,
    @Query('subShiftId') subShiftId?: string,
  ) {
    return this.service.findAll(
      masterShiftId ? Number(masterShiftId) : undefined,
      subShiftId ? Number(subShiftId) : undefined,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'tasks' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ action: 'update', subject: 'tasks' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'update', subject: 'tasks' })
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete task and store audit evidence' })
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteTaskDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.complete(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'tasks' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
