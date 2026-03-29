import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BugReport } from './entities/bug_report.entity'
import { BugReportsService } from './bug_reports.service'
import { BugReportsController } from './bug_reports.controller'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([BugReport, UserDepartment]),
    SlackChannelsModule,
    UserGroupPermissionsModule,
  ],
  controllers: [BugReportsController],
  providers: [BugReportsService],
  exports: [BugReportsService],
})
export class BugReportsModule {}
