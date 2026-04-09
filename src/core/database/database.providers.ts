import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'
import { databaseConfig } from './database.config'
import { Country } from '@/modules/countries/entities/country.entity'
import { City } from '@/modules/cities/entities/city.entity'
import { Company } from '@/modules/companies/entities/company.entity'
import { Role } from '@/modules/roles/entities/role.entity'
import { Permission } from '@/modules/permissions/entities/permission.entity'
import { PermissionGroup } from '@/modules/permission_groups/entities/permission_group.entity'
import { User } from '@/modules/users/entities/user.entity'
import { UserGroupPermission } from '@/modules/user_group_permissions/entities/user_group_permission.entity'
import { Department } from '@/modules/departments/entities/department.entity'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { SlackChannel } from '@/modules/slack_channels/entities/slack_channel.entity'
import { EmployeeRequest } from '@/modules/employee_requests/entities/employee_request.entity'
import { CompanyApprover } from '@/modules/companies/entities/company_approver.entity'
import { CompanyGoogleSheet } from '@/modules/google_sheets/entities/company_google_sheet.entity'
import { AttendanceLog } from '@/modules/attendance_logs/entities/attendance_log.entity'
import { AttendanceLogEdit } from '@/modules/attendance_logs/entities/attendance_log_edit.entity'
import { UserWorkSchedule } from '@/modules/user_work_schedules/entities/user_work_schedule.entity'
import { Group } from '@/modules/groups/entities/group.entity'
import { UserGroup } from '@/modules/groups/entities/user_group.entity'
import { BugReport } from '@/modules/bug_reports/entities/bug_report.entity'
import { TranslationCache } from '@/modules/translate/entities/translation_cache.entity'
import { Message } from '@/modules/messages/entities/message.entity'
import { ChatRoom } from '@/modules/chat/entities/chat-room.entity'
import { ChatRoomMember } from '@/modules/chat/entities/chat-room-member.entity'
import { MessageReaction } from '@/modules/message_reactions/entities/message-reaction.entity'
import { PinnedMessage } from '@/modules/pinned-messages/entities/pinned_message.entity'
import { Meeting } from '@/modules/meetings/entities/meeting.entity'
import { MeetingParticipant } from '@/modules/meetings/entities/meeting_participant.entity'
import { MeetingHostSchedule } from '@/modules/meetings/entities/meeting_host_schedule.entity'
import { MeetingPin } from '@/modules/meetings/entities/meeting_pin.entity'
import { MeetingCompany } from '@/modules/meetings/entities/meeting_company.entity'

export const DatabaseProvider = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],

  useFactory: async () => {
    return {
      ...databaseConfig,
      entities: [
        Country,
        City,
        Company,
        Role,
        Permission,
        PermissionGroup,
        User,
        UserGroupPermission,
        Department,
        UserDepartment,
        SlackChannel,
        EmployeeRequest,
        CompanyApprover,
        CompanyGoogleSheet,
        AttendanceLog,
        AttendanceLogEdit,
        UserWorkSchedule,
        Group,
        UserGroup,
        BugReport,
        TranslationCache,
        Message,
        ChatRoom,
        ChatRoomMember,
        MessageReaction,
        PinnedMessage,
        Meeting,
        MeetingParticipant,
        MeetingHostSchedule,
        MeetingPin,
        MeetingCompany,
      ],
      migrationsTableName: 'migrations',
      namingStrategy: new SnakeNamingStrategy(),
      propertyNamingStrategy: 'snake_case',
    }
  },

  inject: [ConfigService],
})
