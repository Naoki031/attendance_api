import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MulterModule } from '@nestjs/platform-express'
import { MemoriesController } from './memories.controller'
import { MemoriesService } from './memories.service'
import { MemoryAlbum } from './entities/memory_album.entity'
import { MemoryPhoto } from './entities/memory_photo.entity'
import { MemoryReaction } from './entities/memory_reaction.entity'
import { MemoryComment } from './entities/memory_comment.entity'
import { memoriesMulterConfig } from './config/multer.config'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'
import { UserGroupPermissionsModule } from '@/modules/user_group_permissions/user_group_permissions.module'
import { TranslateModule } from '@/modules/translate/translate.module'
import { ChatModule } from '@/modules/chat/chat.module'
import { UsersModule } from '@/modules/users/users.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoryAlbum, MemoryPhoto, MemoryReaction, MemoryComment]),
    MulterModule.register(memoriesMulterConfig),
    ErrorLogsModule,
    UserGroupPermissionsModule,
    TranslateModule,
    ChatModule,
    UsersModule,
  ],
  controllers: [MemoriesController],
  providers: [MemoriesService],
  exports: [MemoriesService],
})
export class MemoriesModule {}
