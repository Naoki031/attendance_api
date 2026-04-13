import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Message } from './entities/message.entity'
import { MessagesService } from './messages.service'
import { MessagesController } from './messages.controller'
import { ChatModule } from '../chat/chat.module'
import { MessageReactionsModule } from '@/modules/message_reactions/message-reactions.module'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    forwardRef(() => ChatModule),
    MessageReactionsModule,
    ErrorLogsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
