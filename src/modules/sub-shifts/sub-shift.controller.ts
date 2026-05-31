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
import { CreateSubShiftDto } from './dto/create-sub-shift.dto';
import { UpdateSubShiftDto } from './dto/update-sub-shift.dto';
import { SubShiftsService } from './sub-shift.service';

@ApiTags('sub-shifts')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('sub-shifts')
export class SubShiftsController {
  constructor(private readonly service: SubShiftsService) {}

  @Post()
  create(
    @Body() dto: CreateSubShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  findAll(@Query('masterShiftId') masterShiftId?: string) {
    return this.service.findAll(
      masterShiftId ? Number(masterShiftId) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubShiftDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
