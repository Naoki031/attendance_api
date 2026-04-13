import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RoomSection } from './entities/room-section.entity'
import { RoomSectionItem } from './entities/room-section-item.entity'
import { RoomSectionsService } from './room-sections.service'
import { RoomSectionsController } from './room-sections.controller'
import { ErrorLogsModule } from '@/modules/error_logs/error_logs.module'

@Module({
  imports: [TypeOrmModule.forFeature([RoomSection, RoomSectionItem]), ErrorLogsModule],
  controllers: [RoomSectionsController],
  providers: [RoomSectionsService],
  exports: [RoomSectionsService],
})
export class RoomSectionsModule {}
