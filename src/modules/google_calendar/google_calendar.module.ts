import { Module } from '@nestjs/common'
import { GoogleCalendarService } from './google_calendar.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [ErrorLogsModule],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
