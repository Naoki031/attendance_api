import { Controller, Get, Post, Query, Param } from '@nestjs/common'
import { MessagesService } from './messages.service'
import { ChatRoomService } from '../chat/chat-room.service'
import { ChatService } from '../chat/chat.service'
import { ChatGateway } from '../chat/chat.gateway'
import { QueryMessagesDto } from './dto/query-messages.dto'

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatRoomService: ChatRoomService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('thread/:messageId')
  async findThreadReplies(@Param('messageId') messageId: number) {
    return this.messagesService.findByThread(messageId)
  }

  @Get(':roomUuid')
  async findByRoom(@Param('roomUuid') roomUuid: string, @Query() query: QueryMessagesDto) {
    const room = await this.chatRoomService.findByUuid(roomUuid)

    return this.messagesService.findByRoom(room.id, query.cursor, query.limit ?? 20)
  }

  /**
   * Re-translates all messages in a room that have no translation cache.
   * Call this after manually clearing the translation_cache table.
   */
  @Post('retranslate-room/:roomUuid')
  async retranslateRoom(@Param('roomUuid') roomUuid: string): Promise<{ retranslated: number }> {
    const room = await this.chatRoomService.findByUuid(roomUuid)
    const untranslated = await this.messagesService.findUntranslatedByRoom(room.id)

    for (const message of untranslated) {
      const translations = await this.chatService.translateMessage({
        messageId: message.id,
        content: message.content,
        detectedLang: message.detected_lang ?? 'en',
        roomId: room.id,
      })

      if (Object.keys(translations).length > 0) {
        this.chatGateway.broadcastTranslations(room.id, message.id, translations)
      }
    }

    return { retranslated: untranslated.length }
  }
}
