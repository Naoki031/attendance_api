import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'
import { SlackChannelsController } from './slack_channels.controller'
import { SlackChannelsService } from './slack_channels.service'
import { SlackChannel } from './entities/slack_channel.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([SlackChannel, User]), HttpModule, UserGroupPermissionsModule],
  controllers: [SlackChannelsController],
  providers: [SlackChannelsService],
  exports: [SlackChannelsService],
})
export class SlackChannelsModule {}
