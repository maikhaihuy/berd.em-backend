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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { CreateMasterShiftDto } from './dto/create-master-shift.dto';
import { UpdateMasterShiftDto } from './dto/update-master-shift.dto';
import { MasterShiftsService } from './master-shift.service';

@ApiTags('master-shifts')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('master-shifts')
export class MasterShiftsController {
  constructor(private readonly service: MasterShiftsService) {}

  @Post()
  create(
    @Body() dto: CreateMasterShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

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

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMasterShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
