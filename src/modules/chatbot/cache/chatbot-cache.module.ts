import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatbotCacheService } from './chatbot-cache.service'
import { ChatbotLogService } from './chatbot-log.service'
import { ChatbotCacheEntry } from './entities/chatbot-cache-entry.entity'
import { ChatbotPromptSectionHash } from './entities/chatbot-prompt-section-hash.entity'
import { ChatbotLog } from './entities/chatbot-log.entity'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatbotCacheEntry, ChatbotPromptSectionHash, ChatbotLog]),
    ErrorLogsModule,
  ],
  providers: [ChatbotCacheService, ChatbotLogService],
  exports: [ChatbotCacheService, ChatbotLogService],
})
export class ChatbotCacheModule {}
