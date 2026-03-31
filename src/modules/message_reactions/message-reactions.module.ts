import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MessageReaction } from './entities/message-reaction.entity'
import { MessageReactionsService } from './message-reactions.service'

@Module({
  imports: [TypeOrmModule.forFeature([MessageReaction])],
  providers: [MessageReactionsService],
  exports: [MessageReactionsService],
})
export class MessageReactionsModule {}
