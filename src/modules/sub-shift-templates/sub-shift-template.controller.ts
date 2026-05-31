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
import { CreateSubShiftTemplateDto } from './dto/create-sub-shift-template.dto';
import { UpdateSubShiftTemplateDto } from './dto/update-sub-shift-template.dto';
import { SubShiftTemplatesService } from './sub-shift-template.service';

@ApiTags('sub-shift-templates')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('sub-shift-templates')
export class SubShiftTemplatesController {
  constructor(private readonly service: SubShiftTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create sub shift template' })
  create(
    @Body() dto: CreateSubShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.create(dto, user.userId);
  }

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

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubShiftTemplateDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
