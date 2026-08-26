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
import { CaslAbility } from '@modules/auth/decorators/casl-ability.decorator';
import type { AppAbility } from '@modules/casl/casl-ability.factory';
import { CreateMasterShiftTemplateDto } from './dto/create-master-shift-template.dto';
import { UpdateMasterShiftTemplateDto } from './dto/update-master-shift-template.dto';
import { MasterShiftTemplatesService } from './master-shift-template.service';

@ApiTags('master-shift-templates')
@ApiBearerAuth()
@Controller('master-shift-templates')
export class MasterShiftTemplatesController {
  constructor(private readonly service: MasterShiftTemplatesService) {}

  @RequirePermissions({ action: 'create', subject: 'master-shift-templates' })
  @Post()
  @ApiOperation({ summary: 'Create master shift template' })
  create(
    @Body() dto: CreateMasterShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'master-shift-templates' })
  @Get()
  @ApiOperation({ summary: 'List master shift templates' })
  findAll(
    @CaslAbility() ability: AppAbility,
    @Query('branchId') branchId?: string,
  ) {
    return this.service.findAll(
      ability,
      branchId ? Number(branchId) : undefined,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'master-shift-templates' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CaslAbility() ability: AppAbility,
  ) {
    return this.service.findOne(id, ability);
  }

  @RequirePermissions({ action: 'update', subject: 'master-shift-templates' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMasterShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'master-shift-templates' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
