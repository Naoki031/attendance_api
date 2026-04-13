import { Module } from '@nestjs/common'
import { ChatbotController } from './chatbot.controller'
import { ChatbotService } from './chatbot.service'
import { PromptBuilderModule } from './prompt-builder/prompt-builder.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [PromptBuilderModule, ErrorLogsModule],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
