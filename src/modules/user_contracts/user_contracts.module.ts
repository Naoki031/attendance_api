import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserContractsController } from './user_contracts.controller'
import { UserContractsService } from './user_contracts.service'
import { ContractExpiryReminderService } from './contract_expiry_reminder.service'
import { UserContract } from './entities/user_contract.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { EventsModule } from '@/modules/events/events.module'
import { MailModule } from '@/modules/mail/mail.module'
import { NotificationsModule } from '@/modules/notifications/notifications.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserContract, User, UserDepartment]),
    ErrorLogsModule,
    UserGroupPermissionsModule,
    EventsModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [UserContractsController],
  providers: [UserContractsService, ContractExpiryReminderService],
  exports: [UserContractsService],
})
export class UserContractsModule {}
