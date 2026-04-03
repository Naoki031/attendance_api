import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { usersProviders } from './users.provider'
import { User } from './entities/user.entity'
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity'
import { UserWorkSchedule } from '@/modules/user_work_schedules/entities/user_work_schedule.entity'
import { StorageModule } from '@/modules/storage/storage.module'
import { FirebaseModule } from '@/modules/firebase/firebase.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserGroupPermission, UserWorkSchedule]),
    StorageModule,
    FirebaseModule,
    UserGroupPermissionsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, ...usersProviders],
  exports: [UsersService],
})
export class UsersModule {}
