import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { RoomSectionsService } from './room-sections.service'
import { CreateRoomSectionDto } from './dto/create-room-section.dto'
import { UpdateRoomSectionDto } from './dto/update-room-section.dto'
import { AddRoomSectionItemDto } from './dto/add-room-section-item.dto'
import { RemoveRoomSectionItemDto } from './dto/remove-room-section-item.dto'
import { User as UserDecorator } from '@/modules/auth/decorators/user.decorator'
import type { User } from '@/modules/users/entities/user.entity'

@Controller('room-sections')
export class RoomSectionsController {
  constructor(private readonly roomSectionsService: RoomSectionsService) {}

  @Get()
  findAll(@UserDecorator() user: User) {
    return this.roomSectionsService.findAllForUser(user.id)
  }

  @Post()
  create(@UserDecorator() user: User, @Body(ValidationPipe) createDto: CreateRoomSectionDto) {
    return this.roomSectionsService.create(user.id, createDto)
  }

  @Put(':id')
  update(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateRoomSectionDto,
  ) {
    return this.roomSectionsService.update(user.id, id, updateDto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@UserDecorator() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.roomSectionsService.remove(user.id, id)
  }

  @Post(':id/items')
  addItem(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) addDto: AddRoomSectionItemDto,
  ) {
    return this.roomSectionsService.addItem(user.id, id, addDto)
  }

  @Delete(':id/items')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @UserDecorator() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query(new ValidationPipe({ transform: true })) removeDto: RemoveRoomSectionItemDto,
  ) {
    return this.roomSectionsService.removeItem(user.id, id, removeDto)
  }
}
