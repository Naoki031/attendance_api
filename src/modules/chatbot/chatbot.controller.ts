import { Controller, Post, Body, ValidationPipe, ForbiddenException } from '@nestjs/common'
import { ChatbotService } from './chatbot.service'
import { ChatRequestDto } from './dto/chat-message.dto'
import { User } from '@/modules/auth/decorators/user.decorator'
import { PromptBuilderService } from './prompt-builder/prompt-builder.service'

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
    @User() requestingUser: { id: number; email: string; roles: string[] },
  ): Promise<{ reply: string; suggestions: string[] }> {
    const isAdmin = requestingUser.roles?.some((role) =>
      ['admin', 'super', 'super_admin', 'super admin'].includes(role.toLowerCase()),
    )

    return this.chatbotService.chat(dto.messages, dto.tone, dto.language, isAdmin)
  }

  /**
   * Reloads prompt sections from disk.
   * Admin-only endpoint for development convenience.
   */
  @Post('reload-prompts')
  async reloadPrompts(
    @User() requestingUser: { id: number; email: string; roles: string[] },
  ): Promise<{ sections: number }> {
    const isAdmin = requestingUser.roles?.some((role) =>
      ['admin', 'super', 'super_admin', 'super admin'].includes(role.toLowerCase()),
    )

    if (!isAdmin) {
      throw new ForbiddenException('Admin access required')
    }

    await this.promptBuilder.reload()
    return { sections: this.promptBuilder.getSectionCount() }
  }
}
