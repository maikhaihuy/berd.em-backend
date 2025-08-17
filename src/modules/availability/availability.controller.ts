import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  ParseDatePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';

@ApiTags('availability')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  @ApiOperation({ summary: 'Create availability' })
  @ApiResponse({
    status: 201,
    description: 'Availability created successfully',
    type: AvailabilityResponseDto,
  })
  create(
    @Body() createAvailabilityDto: CreateAvailabilityDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    return this.availabilityService.create(
      createAvailabilityDto,
      currentUser.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all availability records' })
  @ApiResponse({
    status: 200,
    description: 'List of availability records',
    type: [AvailabilityResponseDto],
  })
  findAll(
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
    @Query('date', new ParseDatePipe({ optional: true }))
    date?: string,
  ) {
    const passedDate = date ? new Date(date) : new Date();

    // Clone date to avoid mutating original
    const startOfWeek = new Date(passedDate);
    const endOfWeek = new Date(passedDate);

    // Adjust according to locale: assuming week starts on Monday
    const day = passedDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diffToMonday = (day === 0 ? -6 : 1) - day; // shift to Monday

    // Start of week (00:00:00)
    startOfWeek.setDate(passedDate.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // End of week (23:59:59)
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.availabilityService.findAll(
      startOfWeek,
      endOfWeek,
      currentUser.id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get availability by ID' })
  @ApiResponse({
    status: 200,
    description: 'Availability record',
    type: AvailabilityResponseDto,
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    return this.availabilityService.findOne(id, currentUser.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update availability' })
  @ApiResponse({
    status: 200,
    description: 'Availability updated successfully',
    type: AvailabilityResponseDto,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    return this.availabilityService.update(
      id,
      updateAvailabilityDto,
      currentUser.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete availability' })
  @ApiResponse({
    status: 200,
    description: 'Availability deleted successfully',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ) {
    return this.availabilityService.remove(id, currentUser.id);
  }
}
