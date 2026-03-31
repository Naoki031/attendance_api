import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TranslationCache } from './entities/translation_cache.entity'
import { TranslateService } from './translate.service'

@Module({
  imports: [TypeOrmModule.forFeature([TranslationCache])],
  providers: [TranslateService],
  exports: [TranslateService],
})
export class TranslateModule {}
