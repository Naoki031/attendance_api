import { Controller, Post, Body, ValidationPipe, ForbiddenException } from '@nestjs/common'
import { ChatbotService } from './chatbot.service'
import { ChatRequestDto } from './dto/chat-message.dto'
import { User } from '@/modules/auth/decorators/user.decorator'
import type { User as UserEntity } from '@/modules/users/entities/user.entity'
import { PromptBuilderService } from './prompt-builder/prompt-builder.service'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  /**
   * Sends a conversation history to the AI and returns the assistant reply.
   * Admin role is determined from the JWT — not trusted from the request body.
   */
  @Post('message')
  async message(
    @Body(ValidationPipe) dto: ChatRequestDto,
    @User() requestingUser: UserEntity,
  ): Promise<{ reply: string; suggestions: string[] }> {
    const isAdmin = isPrivilegedUser(requestingUser.roles)

    return this.chatbotService.chat(dto.messages, dto.tone, dto.language, isAdmin)
  }

  /**
   * Reloads prompt sections from disk.
   * Admin-only endpoint for development convenience.
   */
  @Post('reload-prompts')
  async reloadPrompts(@User() requestingUser: UserEntity): Promise<{ sections: number }> {
    if (!isPrivilegedUser(requestingUser.roles)) {
      throw new ForbiddenException('Admin access required')
    }

    await this.promptBuilder.reload()
    return { sections: this.promptBuilder.getSectionCount() }
  }
}
