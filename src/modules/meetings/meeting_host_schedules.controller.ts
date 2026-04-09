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
} from '@nestjs/common'
import { MeetingHostSchedulesService } from './meeting_host_schedules.service'
import { CreateHostScheduleDto } from './dto/create-host-schedule.dto'
import { UpdateHostScheduleDto } from './dto/update-host-schedule.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'
import { isPrivilegedUser } from './utils/is-privileged.utility'

@Controller('meetings/:uuid/host-schedules')
export class MeetingHostSchedulesController {
  constructor(private readonly hostSchedulesService: MeetingHostSchedulesService) {}

  @Get()
  findAll(@Param('uuid') uuid: string) {
    return this.hostSchedulesService.findAll(uuid)
  }

  @Get('resolve')
  resolve(@Param('uuid') uuid: string, @Query('date') date: string) {
    const resolveDate = date ?? new Date().toISOString().slice(0, 10)
    return this.hostSchedulesService
      .resolveHostForDateByUuid(uuid, resolveDate)
      .then((userId) => ({ host_user_id: userId, date: resolveDate }))
  }

  @Post()
  create(
    @Param('uuid') uuid: string,
    @UserDecorator() user: User,
    @Body() dto: CreateHostScheduleDto,
  ) {
    return this.hostSchedulesService.create(uuid, user.id, dto, isPrivilegedUser(user.roles))
  }

  @Patch(':id')
  update(
    @Param('uuid') uuid: string,
    @Param('id', ParseIntPipe) id: number,
    @UserDecorator() user: User,
    @Body() dto: UpdateHostScheduleDto,
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
}
