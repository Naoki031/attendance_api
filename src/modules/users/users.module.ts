import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { usersProviders } from './users.provider'
import { User } from './entities/user.entity'
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User, UserGroupPermission])],
  controllers: [UsersController],
  providers: [UsersService, ...usersProviders],
  exports: [UsersService],
})
export class UsersModule {}
