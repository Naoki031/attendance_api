import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EmployeeRequestsController } from './employee_requests.controller'
import { EmployeeRequestsService } from './employee_requests.service'
import { EmployeeRequest } from './entities/employee_request.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { Company } from '@/modules/companies/entities/company.entity'
import { CompanyApprover } from '@/modules/companies/entities/company_approver.entity'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { GoogleSheetsModule } from '@/modules/google_sheets/google_sheets.module'
import { GoogleCalendarModule } from '@/modules/google_calendar/google_calendar.module'
import { EventsModule } from '@/modules/events/events.module'
import { AttendanceLogsModule } from '@/modules/attendance_logs/attendance_logs.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeRequest, User, UserDepartment, Company, CompanyApprover]),
    UserGroupPermissionsModule,
    SlackChannelsModule,
    GoogleSheetsModule,
    GoogleCalendarModule,
    EventsModule,
    AttendanceLogsModule,
  ],
  controllers: [EmployeeRequestsController],
  providers: [EmployeeRequestsService],
})
export class EmployeeRequestsModule {}
