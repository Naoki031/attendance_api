import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common'
import { ChatbotService } from './chatbot.service'
import { ChatRequestDto } from './dto/chat-message.dto'
import { User } from '@/modules/auth/decorators/user.decorator'
import type { User as UserEntity } from '@/modules/users/entities/user.entity'
import { PromptBuilderService } from './prompt-builder/prompt-builder.service'
import { ChatbotLogService } from './cache/chatbot-log.service'
import { isPrivilegedUser } from '@/common/utils/is-privileged.utility'

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly logService: ChatbotLogService,
  ) {}

  /**
   * Sends a conversation history to the AI and returns the assistant reply.
   * Admin role is determined from the JWT — not trusted from the request body.
   */
  @Post('message')
  async message(
    @Body(ValidationPipe) dto: ChatRequestDto,
    @User() requestingUser: UserEntity,
  ): Promise<{ reply: string; suggestions: string[]; fromCache: boolean }> {
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

  /**
   * Returns aggregate chatbot log statistics.
   */
  @Get('stats')
  async getStats(@User() requestingUser: UserEntity) {
    if (!isPrivilegedUser(requestingUser.roles)) {
      throw new ForbiddenException('Admin access required')
    }

    return this.logService.getStats()
  }

  /**
   * Returns paginated chatbot logs with optional date filters.
   */
  @Get('logs')
  async getLogs(
    @User() requestingUser: UserEntity,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!isPrivilegedUser(requestingUser.roles)) {
      throw new ForbiddenException('Admin access required')
    }

    return this.logService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      dateFrom,
      dateTo,
    })
  }
}
