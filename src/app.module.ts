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
import { IclockModule } from './modules/iclock/iclock.module'
import { UserWorkSchedulesModule } from './modules/user_work_schedules/user_work_schedules.module'
import { GroupsModule } from './modules/groups/groups.module'
import { BugReportsModule } from './modules/bug_reports/bug_reports.module'
import { TranslateModule } from './modules/translate/translate.module'
import { ChatModule } from './modules/chat/chat.module'
import { MessagesModule } from './modules/messages/messages.module'
import { FirebaseModule } from './modules/firebase/firebase.module'
import { MessageReactionsModule } from './modules/message_reactions/message-reactions.module'
import { StorageModule } from './modules/storage/storage.module'
import { FaceModule } from './modules/face/face.module'
import { FeaturesModule } from './modules/features/features.module'
import { JwtStrategy } from '@/modules/auth/strategy/jwt.strategy'
import { APP_GUARD } from '@nestjs/core'
import { JwtGuard } from '@/modules/auth/guards/jwt.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
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
    IclockModule,
    UserWorkSchedulesModule,
    GroupsModule,
    ChatbotModule,
    BugReportsModule,
    TranslateModule,
    ChatModule,
    MessagesModule,
    FirebaseModule,
    MessageReactionsModule,
    StorageModule,
    FaceModule,
    FeaturesModule,
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
