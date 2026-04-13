import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ErrorLog } from './entities/error_log.entity'
import { ErrorLogsService } from './error_logs.service'
import { ErrorLogsController } from './error_logs.controller'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([ErrorLog]), UserGroupPermissionsModule],
  controllers: [ErrorLogsController],
  providers: [ErrorLogsService],
  exports: [ErrorLogsService],
})
export class ErrorLogsModule {}
