import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PinnedMessage } from './entities/pinned_message.entity'
import { PinnedMessagesService } from './pinned-messages.service'

@Module({
  imports: [TypeOrmModule.forFeature([PinnedMessage])],
  providers: [PinnedMessagesService],
  exports: [PinnedMessagesService],
})
export class PinnedMessagesModule {}
