import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserDepartmentsController } from './user_departments.controller'
import { UserDepartmentsService } from './user_departments.service'
import { UserDepartment } from './entities/user_department.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([UserDepartment]), UserGroupPermissionsModule],
  controllers: [UserDepartmentsController],
  providers: [UserDepartmentsService],
})
export class UserDepartmentsModule {}
