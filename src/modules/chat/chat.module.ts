import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatGateway } from './chat.gateway'
import { ChatService } from './chat.service'
import { ChatRoomService } from './chat-room.service'
import { ChatRoomController } from './chat-room.controller'
import { ChatRoom } from './entities/chat-room.entity'
import { ChatRoomMember } from './entities/chat-room-member.entity'
import { Message as MessageEntity } from '../messages/entities/message.entity'
import { TranslateModule } from '../translate/translate.module'
import { MessagesModule } from '../messages/messages.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { FirebaseModule } from '@/modules/firebase/firebase.module'
import { UsersModule } from '@/modules/users/users.module'
import { MessageReactionsModule } from '@/modules/message_reactions/message-reactions.module'
// TODO: Import when module is ready:
// import { GlossaryModule } from '../glossary/glossary.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatRoomMember, MessageEntity]),
    TranslateModule,
    forwardRef(() => MessagesModule),
    UserGroupPermissionsModule,
    FirebaseModule,
    UsersModule,
    MessageReactionsModule,
    // GlossaryModule,
  ],
  controllers: [ChatRoomController],
  providers: [ChatService, ChatRoomService, ChatGateway],
  exports: [ChatService, ChatRoomService],
})
export class ChatModule {}
