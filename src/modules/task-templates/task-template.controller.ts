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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { TaskTemplatesService } from './task-template.service';

@ApiTags('task-templates')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('task-templates')
export class TaskTemplatesController {
  constructor(private readonly service: TaskTemplatesService) {}

  @Post()
  create(
    @Body() dto: CreateTaskTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.service.findAll(branchId ? Number(branchId) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
