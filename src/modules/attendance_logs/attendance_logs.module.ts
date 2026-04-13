import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { AttendanceLog } from './entities/attendance_log.entity'
import { AttendanceLogEdit } from './entities/attendance_log_edit.entity'
import { AttendanceLogsService } from './attendance_logs.service'
import { AttendanceLogsController } from './attendance_logs.controller'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { EmployeeRequest } from '@/modules/employee_requests/entities/employee_request.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { Company } from '@/modules/companies/entities/company.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserWorkSchedule } from '@/modules/user_work_schedules/entities/user_work_schedule.entity'
import { GoogleSheetsModule } from '@/modules/google_sheets/google_sheets.module'
import { FaceModule } from '@/modules/face/face.module'
import { StorageModule } from '@/modules/storage/storage.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceLog,
      AttendanceLogEdit,
      EmployeeRequest,
      UserDepartment,
      Company,
      User,
      UserWorkSchedule,
    ]),
    UserGroupPermissionsModule,
    ConfigModule,
    GoogleSheetsModule,
    FaceModule,
    StorageModule,
    SlackChannelsModule,
    ErrorLogsModule,
  ],
  controllers: [AttendanceLogsController],
  providers: [AttendanceLogsService],
  exports: [AttendanceLogsService],
})
export class AttendanceLogsModule {}
