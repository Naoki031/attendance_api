import { Module, Global } from '@nestjs/common'
import { MailService } from './mail.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'
import { EmailTemplatesModule } from '@/modules/email_templates/email_templates.module'

@Global()
@Module({
  imports: [ErrorLogsModule, EmailTemplatesModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
