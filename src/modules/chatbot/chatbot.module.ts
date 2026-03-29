import { Module } from '@nestjs/common'
import { ChatbotController } from './chatbot.controller'
import { ChatbotService } from './chatbot.service'
import { PromptBuilderModule } from './prompt-builder/prompt-builder.module'

@Module({
  imports: [PromptBuilderModule],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
