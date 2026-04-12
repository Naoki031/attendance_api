import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RoomSection } from './entities/room-section.entity'
import { RoomSectionItem } from './entities/room-section-item.entity'
import { RoomSectionsService } from './room-sections.service'
import { RoomSectionsController } from './room-sections.controller'

@Module({
  imports: [TypeOrmModule.forFeature([RoomSection, RoomSectionItem])],
  controllers: [RoomSectionsController],
  providers: [RoomSectionsService],
  exports: [RoomSectionsService],
})
export class RoomSectionsModule {}
