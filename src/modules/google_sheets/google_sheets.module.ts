import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { GoogleSheetsService } from './google_sheets.service'
import { CompanyGoogleSheetsService } from './company_google_sheets.service'
import { CompanyGoogleSheetsController } from './company_google_sheets.controller'
import { CompanyGoogleSheet } from './entities/company_google_sheet.entity'
import { UserGroupPermissionsModule } from '../user_group_permissions/user_group_permissions.module'
import { SlackChannelsModule } from '@/modules/slack_channels/slack_channels.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CompanyGoogleSheet]),
    UserGroupPermissionsModule,
    SlackChannelsModule,
    ErrorLogsModule,
  ],
  providers: [GoogleSheetsService, CompanyGoogleSheetsService],
  controllers: [CompanyGoogleSheetsController],
  exports: [GoogleSheetsService, CompanyGoogleSheetsService],
})
export class GoogleSheetsModule {}
