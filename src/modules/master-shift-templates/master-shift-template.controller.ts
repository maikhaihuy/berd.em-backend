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
import { CreateMasterShiftTemplateDto } from './dto/create-master-shift-template.dto';
import { UpdateMasterShiftTemplateDto } from './dto/update-master-shift-template.dto';
import { MasterShiftTemplatesService } from './master-shift-template.service';

@ApiTags('master-shift-templates')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('master-shift-templates')
export class MasterShiftTemplatesController {
  constructor(private readonly service: MasterShiftTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create master shift template' })
  create(
    @Body() dto: CreateMasterShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List master shift templates' })
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
    @Body() dto: UpdateMasterShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
