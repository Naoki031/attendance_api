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
} from '@nestjs/common'
import { MeetingHostSchedulesService } from './meeting_host_schedules.service'
import { CreateHostScheduleDto } from './dto/create-host-schedule.dto'
import { UpdateHostScheduleDto } from './dto/update-host-schedule.dto'
import { ExcludeDateDto } from './dto/exclude-date.dto'
import { TruncateScheduleDto } from './dto/truncate-schedule.dto'
import { SwapDatesDto } from './dto/swap-dates.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'

@Controller('meetings/:uuid/host-schedules')
export class MeetingHostSchedulesController {
  constructor(private readonly hostSchedulesService: MeetingHostSchedulesService) {}

  @Get()
  findAll(@Param('uuid') uuid: string) {
    return this.hostSchedulesService.findAll(uuid)
  }

  @Get('resolve')
  resolve(@Param('uuid') uuid: string, @Query('date') date: string) {
    return this.hostSchedulesService
      .resolveHostForDateByUuid(uuid, date)
      .then((userId) => ({ host_user_id: userId, date }))
  }

  @Post()
  create(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: CreateHostScheduleDto,
  ) {
    return this.hostSchedulesService.create(uuid, user.id, dto, isPrivilegedUser(user.roles))
  }

  @Patch(':id')
  update(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: UpdateHostScheduleDto,
  ) {
    return this.hostSchedulesService.update(id, uuid, user.id, dto, isPrivilegedUser(user.roles))
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
  ) {
    return this.hostSchedulesService.remove(id, uuid, user.id, isPrivilegedUser(user.roles))
  }

  /** Removes a single date from a schedule (adds to excluded_dates or deletes if one_time). */
  @Patch(':id/exclude-date')
  @HttpCode(HttpStatus.NO_CONTENT)
  excludeDate(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: ExcludeDateDto,
  ) {
    return this.hostSchedulesService.excludeDate(
      id,
      uuid,
      user.id,
      dto.date,
      isPrivilegedUser(user.roles),
    )
  }

  /** Truncates a schedule: removes the given date and all dates after it. */
  @Patch(':id/truncate')
  @HttpCode(HttpStatus.NO_CONTENT)
  truncate(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: TruncateScheduleDto,
  ) {
    return this.hostSchedulesService.truncateFromDate(
      id,
      uuid,
      user.id,
      dto.date,
      isPrivilegedUser(user.roles),
    )
  }

  /** Swaps the hosts of two dates across all schedules of the meeting. */
  @Post('swap-dates')
  @HttpCode(HttpStatus.NO_CONTENT)
  swapDates(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body(ValidationPipe) dto: SwapDatesDto,
  ) {
    return this.hostSchedulesService.swapDates(uuid, user.id, dto, isPrivilegedUser(user.roles))
  }
}
