import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { Notification } from './entities/notification.entity'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), ErrorLogsModule, UserGroupPermissionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
