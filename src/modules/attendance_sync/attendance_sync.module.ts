import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { User } from '@/modules/users/entities/user.entity'
import { AttendanceLogsModule } from '@/modules/attendance_logs/attendance_logs.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { ZkDeviceService } from './zk-device.service'
import { AttendanceSyncService } from './attendance_sync.service'
import { AttendanceSyncController } from './attendance_sync.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AttendanceLogsModule,
    UserGroupPermissionsModule,
    SlackChannelsModule,
    ConfigModule,
  ],
  controllers: [AttendanceSyncController],
  providers: [ZkDeviceService, AttendanceSyncService],
})
export class AttendanceSyncModule {}
