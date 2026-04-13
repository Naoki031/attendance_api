import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MessageReaction } from './entities/message-reaction.entity'
import { MessageReactionsService } from './message-reactions.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [TypeOrmModule.forFeature([MessageReaction]), ErrorLogsModule],
  providers: [MessageReactionsService],
  exports: [MessageReactionsService],
})
export class MessageReactionsModule {}
