import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PinnedMessage } from './entities/pinned_message.entity'
import { PinnedMessagesService } from './pinned-messages.service'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [TypeOrmModule.forFeature([PinnedMessage]), ErrorLogsModule],
  providers: [PinnedMessagesService],
  exports: [PinnedMessagesService],
})
export class PinnedMessagesModule {}
