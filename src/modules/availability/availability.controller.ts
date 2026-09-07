import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { CaslAbility } from '@modules/auth/decorators/casl-ability.decorator';
import type { AppAbility } from '@modules/casl/casl-ability.factory';

@ApiTags('availability')
@ApiBearerAuth()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @RequirePermissions({ action: 'create', subject: 'availability' })
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
      currentUser.userId,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'availability' })
  @Get()
  @ApiOperation({
    summary: 'Get all availability records',
    description:
      'An Employee always sees only their own registrations, regardless of query params. ' +
      'A Manager sees every registration for branches they manage when `branchId` is set to a managed branch, ' +
      'and an empty list for a branch they do not manage.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of availability records',
    type: [AvailabilityResponseDto],
  })
  findAll(
    @CaslAbility() ability: AppAbility,
    @Query('date', new ParseDatePipe({ optional: true }))
    date?: string,
    @Query('branchId', new ParseIntPipe({ optional: true }))
    branchId?: number,
    @Query('subShiftId', new ParseIntPipe({ optional: true }))
    subShiftId?: number,
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
      ability,
      branchId,
      subShiftId,
    );
  }

  @RequirePermissions({ action: 'read', subject: 'availability' })
  @Get(':id')
  @ApiOperation({ summary: 'Get availability by ID' })
  @ApiResponse({
    status: 200,
    description: 'Availability record',
    type: AvailabilityResponseDto,
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CaslAbility() ability: AppAbility,
  ) {
    return this.availabilityService.findOne(id, ability);
  }

  @RequirePermissions({ action: 'update', subject: 'availability' })
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
      currentUser.userId,
    );
  }

  @RequirePermissions({ action: 'delete', subject: 'availability' })
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete availability',
    description:
      "Returns 404 (not 403) when the caller isn't the owning employee or an Admin.",
  })
  @ApiResponse({
    status: 200,
    description: 'Availability deleted successfully',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
    @CaslAbility() ability: AppAbility,
  ) {
    return this.availabilityService.remove(id, currentUser.userId, ability);
  }
}
