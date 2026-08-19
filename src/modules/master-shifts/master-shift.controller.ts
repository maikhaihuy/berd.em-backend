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
import { CreateMasterShiftDto } from './dto/create-master-shift.dto';
import { UpdateMasterShiftDto } from './dto/update-master-shift.dto';
import { MasterShiftsService } from './master-shift.service';

@ApiTags('master-shifts')
@ApiBearerAuth()
@Controller('master-shifts')
export class MasterShiftsController {
  constructor(private readonly service: MasterShiftsService) {}

  @RequirePermissions({ action: 'create', subject: 'master-shifts' })
  @Post()
  create(
    @Body() dto: CreateMasterShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'generate', subject: 'master-shifts' })
  @Post('generate')
  @ApiOperation({
    summary: 'Generate master shift, sub shifts, and tasks from a template',
  })
  generate(
    @Body('masterShiftTemplateId', ParseIntPipe) masterShiftTemplateId: number,
    @Body('workDate') workDate: string,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.generateFromTemplate(
      masterShiftTemplateId,
      workDate,
      user.userId,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'master-shifts' })
  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll(
      branchId ? Number(branchId) : undefined,
      from,
      to,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'master-shifts' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ action: 'update', subject: 'master-shifts' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMasterShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'master-shifts' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
