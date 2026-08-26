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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { CaslAbility } from '@modules/auth/decorators/casl-ability.decorator';
import type { AppAbility } from '@modules/casl/casl-ability.factory';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { TaskTemplatesService } from './task-template.service';

@ApiTags('task-templates')
@ApiBearerAuth()
@Controller('task-templates')
export class TaskTemplatesController {
  constructor(private readonly service: TaskTemplatesService) {}

  @RequirePermissions({ action: 'create', subject: 'task-templates' })
  @Post()
  create(
    @Body() dto: CreateTaskTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'task-templates' })
  @Get()
  findAll(
    @CaslAbility() ability: AppAbility,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.findAll(
      ability,
      branchId ? Number(branchId) : undefined,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'task-templates' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CaslAbility() ability: AppAbility,
  ) {
    return this.service.findOne(id, ability);
  }

  @RequirePermissions({ action: 'update', subject: 'task-templates' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'task-templates' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
