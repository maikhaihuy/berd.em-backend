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
import { CreateSubShiftTemplateDto } from './dto/create-sub-shift-template.dto';
import { UpdateSubShiftTemplateDto } from './dto/update-sub-shift-template.dto';
import { SubShiftTemplatesService } from './sub-shift-template.service';

@ApiTags('sub-shift-templates')
@ApiBearerAuth()
@Controller('sub-shift-templates')
export class SubShiftTemplatesController {
  constructor(private readonly service: SubShiftTemplatesService) {}

  @RequirePermissions({ action: 'create', subject: 'sub-shift-templates' })
  @Post()
  @ApiOperation({ summary: 'Create sub shift template' })
  create(
    @Body() dto: CreateSubShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'sub-shift-templates' })
  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('masterShiftTemplateId') masterShiftTemplateId?: string,
  ) {
    return this.service.findAll(
      branchId ? Number(branchId) : undefined,
      masterShiftTemplateId ? Number(masterShiftTemplateId) : undefined,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'sub-shift-templates' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ action: 'update', subject: 'sub-shift-templates' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'sub-shift-templates' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
