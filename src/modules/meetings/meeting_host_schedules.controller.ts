import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { MeetingHostSchedulesService } from './meeting_host_schedules.service'
import { MeetingsGateway } from './meetings.gateway'
import { CreateHostScheduleDto } from './dto/create-host-schedule.dto'
import { UpdateHostScheduleDto } from './dto/update-host-schedule.dto'
import { ExcludeDateDto } from './dto/exclude-date.dto'
import { TruncateScheduleDto } from './dto/truncate-schedule.dto'
import { SwapDatesDto } from './dto/swap-dates.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('meetings/:uuid/host-schedules')
@UseGuards(PermissionsGuard)
export class MeetingHostSchedulesController {
  constructor(
    private readonly hostSchedulesService: MeetingHostSchedulesService,
    private readonly meetingsGateway: MeetingsGateway,
  ) {}

  @Get()
  @Permissions('all_privileges', 'read')
  findAll(@Param('uuid') uuid: string) {
    return this.hostSchedulesService.findAll(uuid)
  }

  @Get('resolve')
  @Permissions('all_privileges', 'read')
  resolve(@Param('uuid') uuid: string, @Query('date') date: string) {
    return this.hostSchedulesService
      .resolveHostForDateByUuid(uuid, date)
      .then((userId) => ({ host_user_id: userId, date }))
  }

  @Post()
  @Permissions('all_privileges', 'create')
  async create(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: CreateHostScheduleDto,
  ) {
    const result = await this.hostSchedulesService.create(uuid, user.id, dto, isPrivilegedUser(user.roles))
    this.meetingsGateway.emitHostScheduleChanged(uuid)
    return result
  }

  @Patch(':id')
  @Permissions('all_privileges', 'update')
  async update(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: UpdateHostScheduleDto,
  ) {
    const result = await this.hostSchedulesService.update(id, uuid, user.id, dto, isPrivilegedUser(user.roles))
    this.meetingsGateway.emitHostScheduleChanged(uuid)
    return result
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  async remove(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
  ) {
    await this.hostSchedulesService.remove(id, uuid, user.id, isPrivilegedUser(user.roles))
    this.meetingsGateway.emitHostScheduleChanged(uuid)
  }

  /** Removes a single date from a schedule (adds to excluded_dates or deletes if one_time). */
  @Patch(':id/exclude-date')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'update')
  async excludeDate(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: ExcludeDateDto,
  ) {
    await this.hostSchedulesService.excludeDate(
      id,
      uuid,
      user.id,
      dto.date,
      isPrivilegedUser(user.roles),
    )
    this.meetingsGateway.emitHostScheduleChanged(uuid)
  }

  /** Truncates a schedule: removes the given date and all dates after it. */
  @Patch(':id/truncate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'update')
  async truncate(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: TruncateScheduleDto,
  ) {
    await this.hostSchedulesService.truncateFromDate(
      id,
      uuid,
      user.id,
      dto.date,
      isPrivilegedUser(user.roles),
    )
    this.meetingsGateway.emitHostScheduleChanged(uuid)
  }

  /** Swaps the hosts of two dates across all schedules of the meeting. */
  @Post('swap-dates')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'update')
  async swapDates(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: SwapDatesDto,
  ) {
    await this.hostSchedulesService.swapDates(uuid, user.id, dto, isPrivilegedUser(user.roles))
    this.meetingsGateway.emitHostScheduleChanged(uuid)
  }
}
