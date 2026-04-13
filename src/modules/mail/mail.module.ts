import { Module, Global } from '@nestjs/common'
import { MailService } from './mail.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Global()
@Module({
  imports: [ErrorLogsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
