import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { GroupsController } from './groups.controller'
import { GroupsService } from './groups.service'
import { Group } from './entities/group.entity'
import { UserGroup } from './entities/user_group.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, UserGroup]),
    UserGroupPermissionsModule,
    ErrorLogsModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
