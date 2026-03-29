import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { UserWorkSchedule } from './entities/user_work_schedule.entity'
import { UserWorkSchedulesService } from './user_work_schedules.service'
import { UserWorkSchedulesController } from './user_work_schedules.controller'

@Module({
  imports: [TypeOrmModule.forFeature([UserWorkSchedule]), UserGroupPermissionsModule],
  controllers: [UserWorkSchedulesController],
  providers: [UserWorkSchedulesService],
  exports: [UserWorkSchedulesService],
})
export class UserWorkSchedulesModule {}
