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
import { CreateSubShiftDto } from './dto/create-sub-shift.dto';
import { UpdateSubShiftDto } from './dto/update-sub-shift.dto';
import { SubShiftsService } from './sub-shift.service';

@ApiTags('sub-shifts')
@ApiBearerAuth()
@Controller('sub-shifts')
export class SubShiftsController {
  constructor(private readonly service: SubShiftsService) {}

  @RequirePermissions({ action: 'create', subject: 'sub-shifts' })
  @Post()
  create(
    @Body() dto: CreateSubShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions({ action: 'read', subject: 'sub-shifts' })
  @Get()
  findAll(@Query('masterShiftId') masterShiftId?: string) {
    return this.service.findAll(
      masterShiftId ? Number(masterShiftId) : undefined,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'sub-shifts' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @RequirePermissions({ action: 'update', subject: 'sub-shifts' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @RequirePermissions({ action: 'delete', subject: 'sub-shifts' })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
