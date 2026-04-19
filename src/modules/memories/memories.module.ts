import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MulterModule } from '@nestjs/platform-express'
import { MemoriesController } from './memories.controller'
import { MemoriesService } from './memories.service'
import { MemoriesGateway } from './memories.gateway'
import { MemoryAlbum } from './entities/memory_album.entity'
import { MemoryPhoto } from './entities/memory_photo.entity'
import { MemoryReaction } from './entities/memory_reaction.entity'
import { MemoryComment } from './entities/memory_comment.entity'
import { MemoryAlbumComment } from './entities/memory_album_comment.entity'
import { memoriesMulterConfig } from './config/multer.config'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { TranslateModule } from '@/modules/translate/translate.module'
import { ChatModule } from '@/modules/chat/chat.module'
import { UsersModule } from '@/modules/users/users.module'
import { NotificationsModule } from '@/modules/notifications/notifications.module'
import { EventsModule } from '@/modules/events/events.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MemoryAlbum,
      MemoryPhoto,
      MemoryReaction,
      MemoryComment,
      MemoryAlbumComment,
    ]),
    MulterModule.register(memoriesMulterConfig),
    ErrorLogsModule,
    UserGroupPermissionsModule,
    TranslateModule,
    ChatModule,
    UsersModule,
    NotificationsModule,
    EventsModule,
  ],
  controllers: [MemoriesController],
  providers: [MemoriesService, MemoriesGateway],
  exports: [MemoriesService],
})
export class MemoriesModule {}
