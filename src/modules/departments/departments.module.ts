import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DepartmentsController } from './departments.controller'
import { DepartmentsService } from './departments.service'
import { departmentsProviders } from './departments.provider'
import { Department } from './entities/department.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([Department]), UserGroupPermissionsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, ...departmentsProviders],
})
export class DepartmentsModule {}
