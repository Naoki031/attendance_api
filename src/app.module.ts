import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ChatbotModule } from './modules/chatbot/chatbot.module'
import { ScheduleModule } from '@nestjs/schedule'
import { DatabaseModule } from './core/database/database.module'
import { CountriesModule } from './modules/countries/countries.module'
// import { RolesModule } from './modules/roles/roles.module';
// import { AuthService } from './modules/auth/auth.service';
// import { AuthModule } from './modules/auth/auth.module';
// import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module'
import { PermissionsModule } from './modules/permissions/permissions.module'
import { UsersModule } from './modules/users/users.module'
import { PermissionGroupsModule } from './modules/permission_groups/permission_groups.module'
import { UserGroupPermissionsModule } from './modules/user_group_permissions/user_group_permissions.module'
import { AuthModule } from './modules/auth/auth.module'
import { CitiesModule } from './modules/cities/cities.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { DepartmentsModule } from './modules/departments/departments.module'
import { UserDepartmentsModule } from './modules/user_departments/user_departments.module'
import { SlackChannelsModule } from './modules/slack_channels/slack_channels.module'
import { EmployeeRequestsModule } from './modules/employee_requests/employee_requests.module'
import { EventsModule } from './modules/events/events.module'
import { AttendanceLogsModule } from './modules/attendance_logs/attendance_logs.module'
import { AttendanceSyncModule } from './modules/attendance_sync/attendance_sync.module'
import { IclockModule } from './modules/iclock/iclock.module'
import { UserWorkSchedulesModule } from './modules/user_work_schedules/user_work_schedules.module'
import { GroupsModule } from './modules/groups/groups.module'
import { BugReportsModule } from './modules/bug_reports/bug_reports.module'
import { JwtStrategy } from '@/modules/auth/strategy/jwt.strategy'
import { APP_GUARD } from '@nestjs/core'
import { JwtGuard } from '@/modules/auth/guards/jwt.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CountriesModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    PermissionGroupsModule,
    UserGroupPermissionsModule,
    AuthModule,
    CitiesModule,
    CompaniesModule,
    DepartmentsModule,
    UserDepartmentsModule,
    SlackChannelsModule,
    EmployeeRequestsModule,
    EventsModule,
    AttendanceLogsModule,
    AttendanceSyncModule,
    IclockModule,
    UserWorkSchedulesModule,
    GroupsModule,
    ChatbotModule,
    BugReportsModule,
    // EmployeesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    JwtStrategy,
  ],
  // controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
