import { Module, forwardRef } from '@nestjs/common'
import { PromptBuilderService } from './prompt-builder.service'
import { ChatbotCacheModule } from '../cache/chatbot-cache.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [forwardRef(() => ChatbotCacheModule), ErrorLogsModule],
  providers: [PromptBuilderService],
  exports: [PromptBuilderService],
})
export class PromptBuilderModule {}
