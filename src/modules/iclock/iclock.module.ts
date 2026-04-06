import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { User } from '@/modules/users/entities/user.entity'
import { AttendanceLogsModule } from '@/modules/attendance_logs/attendance_logs.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { IclockService } from './iclock.service'
import { IclockController } from './iclock.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AttendanceLogsModule,
    ConfigModule,
    SlackChannelsModule,
  ],
  controllers: [IclockController],
  providers: [IclockService],
})
export class IclockModule {}
