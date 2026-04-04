import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common'
import { ChatRoomService } from './chat-room.service'
import { CreateChatRoomDto } from './dto/create-chat-room.dto'
import { UpdateChatRoomDto } from './dto/update-chat-room.dto'
import { InviteUserDto } from './dto/invite-user.dto'
import { PinnedMessagesService } from '@/modules/pinned-messages/pinned-messages.service'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { User } from '@/modules/auth/decorators/user.decorator'
import type { User as UserEntity } from '@/modules/users/entities/user.entity'

@Controller('chat-rooms')
@UseGuards(PermissionsGuard)
export class ChatRoomController {
  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly pinnedMessagesService: PinnedMessagesService,
  ) {}

  @Post()
  async create(@Body(ValidationPipe) dto: CreateChatRoomDto, @User() user: UserEntity) {
    return this.chatRoomService.create(user.id, dto)
  }

  @Get()
  async findMyRooms(@User() user: UserEntity) {
    return this.chatRoomService.findMyRooms(user.id)
  }

  @Get('public')
  async findPublicRooms() {
    return this.chatRoomService.findPublicRooms()
  }

  @Get('unread-counts')
  async getUnreadCounts(@User() user: UserEntity) {
    return this.chatRoomService.getUnreadCounts(user.id)
  }

  @Get('unread-messages')
  async getUnreadMessages(@User() user: UserEntity) {
    return this.chatRoomService.getUnreadMessages(user.id)
  }

  @Get('read-messages')
  async getRecentReadMessages(@User() user: UserEntity) {
    return this.chatRoomService.getRecentReadMessages(user.id)
  }

  @Get(':uuid')
  async findOne(@Param('uuid') uuid: string, @User() user: UserEntity) {
    return this.chatRoomService.findByUuid(uuid, user.id)
  }

  @Put(':uuid')
  async update(
    @Param('uuid') uuid: string,
    @Body(ValidationPipe) dto: UpdateChatRoomDto,
    @User() user: UserEntity,
  ) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.update(room.id, user.id, dto)
  }

  @Delete(':uuid')
  async remove(@Param('uuid') uuid: string, @User() user: UserEntity) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.remove(room.id, user.id)
  }

  @Post(':uuid/join')
  async join(@Param('uuid') uuid: string, @User() user: UserEntity) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.join(room.id, user.id)
  }

  @Post(':uuid/leave')
  async leave(@Param('uuid') uuid: string, @User() user: UserEntity) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.leave(room.id, user.id)
  }

  @Get(':uuid/members')
  async getMembers(@Param('uuid') uuid: string) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.getMembers(room.id)
  }

  @Get(':uuid/last-read-at')
  async getLastReadAt(@Param('uuid') uuid: string, @User() user: UserEntity) {
    const room = await this.chatRoomService.findByUuid(uuid)
    const lastReadAt = await this.chatRoomService.getLastReadAt(room.id, user.id)

    return { last_read_at: lastReadAt?.toISOString() ?? null }
  }

  @Post(':uuid/invite')
  async invite(
    @Param('uuid') uuid: string,
    @Body(ValidationPipe) dto: InviteUserDto,
    @User() user: UserEntity,
  ) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.invite(room.id, user.id, dto)
  }

  @Delete(':uuid/members/:userId')
  async removeMember(
    @Param('uuid') uuid: string,
    @Param('userId') userId: string,
    @User() user: UserEntity,
  ) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.chatRoomService.removeMember(room.id, user.id, Number(userId))
  }

  @Post(':uuid/mark-read')
  async markAsRead(@Param('uuid') uuid: string, @User() user: UserEntity) {
    const room = await this.chatRoomService.findByUuid(uuid)
    await this.chatRoomService.markAsRead(room.id, user.id)

    return { success: true }
  }

  @Get(':uuid/pinned-messages')
  async getPinnedMessages(@Param('uuid') uuid: string) {
    const room = await this.chatRoomService.findByUuid(uuid)

    return this.pinnedMessagesService.findByRoom(room.id)
  }
}
