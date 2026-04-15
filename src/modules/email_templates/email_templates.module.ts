import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EmailTemplate } from './entities/email_template.entity'
import { EmailTemplatesService } from './email_templates.service'
import { EmailTemplatesController } from './email_templates.controller'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate]), ErrorLogsModule, UserGroupPermissionsModule],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
