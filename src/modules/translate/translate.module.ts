import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TranslationCache } from './entities/translation_cache.entity'
import { TranslationLog } from './entities/translation_log.entity'
import { TranslateService } from './translate.service'
import { TranslationLogService } from './translation-log.service'
import { TranslationLogController } from './translation-log.controller'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([TranslationCache, TranslationLog]),
    UserGroupPermissionsModule,
  ],
  controllers: [TranslationLogController],
  providers: [TranslateService, TranslationLogService],
  exports: [TranslateService],
})
export class TranslateModule {}
