import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DepartmentsController } from './departments.controller'
import { DepartmentsService } from './departments.service'
import { departmentsProviders } from './departments.provider'
import { Department } from './entities/department.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [TypeOrmModule.forFeature([Department]), UserGroupPermissionsModule, ErrorLogsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, ...departmentsProviders],
})
export class DepartmentsModule {}
