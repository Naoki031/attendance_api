import { Controller, Get, Query, Param } from '@nestjs/common'
import { MessagesService } from './messages.service'
import { ChatRoomService } from '../chat/chat-room.service'
import { QueryMessagesDto } from './dto/query-messages.dto'

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatRoomService: ChatRoomService,
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
}
