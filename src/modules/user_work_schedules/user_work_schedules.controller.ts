import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  Query,
} from '@nestjs/common'
import { UserWorkSchedulesService } from './user_work_schedules.service'
import { CreateUserWorkScheduleDto } from './dto/create-user_work_schedule.dto'
import { UpdateUserWorkScheduleDto } from './dto/update-user_work_schedule.dto'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'

@Controller('user-work-schedules')
@UseGuards(PermissionsGuard)
export class UserWorkSchedulesController {
  constructor(private readonly userWorkSchedulesService: UserWorkSchedulesService) {}

  @Post()
  @Permissions('create')
  create(@Body(ValidationPipe) createDto: CreateUserWorkScheduleDto) {
    return this.userWorkSchedulesService.create(createDto)
  }

  @Get()
  @Permissions('read')
  findByUser(@Query('user_id', ParseIntPipe) userId: number) {
    return this.userWorkSchedulesService.findByUser(userId)
  }

  @Get(':id')
  @Permissions('read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userWorkSchedulesService.findOne(id)
  }

  @Put(':id')
  @Permissions('update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateUserWorkScheduleDto,
  ) {
    return this.userWorkSchedulesService.update(id, updateDto)
  }

  @Delete(':id')
  @Permissions('delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userWorkSchedulesService.remove(id)
  }
}
