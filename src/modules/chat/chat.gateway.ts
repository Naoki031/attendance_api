import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { ChatService } from './chat.service'
import { ChatRoomService } from './chat-room.service'
import { ChatRoomType, ChatRoomVisibility } from './entities/chat-room.entity'
import { FirebaseService } from '@/modules/firebase/firebase.service'
import { UsersService } from '@/modules/users/users.service'
import { MessageReactionsService } from '@/modules/message_reactions/message-reactions.service'
import { PinnedMessagesService } from '@/modules/pinned-messages/pinned-messages.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

interface RoomUser {
  userId: number
  username: string
  avatar: string
  language: string
}

interface JoinRoomPayload {
  roomUuid: string
  userId: number
  username: string
  avatar: string
  language: string
}

interface LeaveRoomPayload {
  roomUuid: string
}

interface SendMessagePayload {
  roomUuid: string
  content: string
  mentionedUserIds?: number[]
}

interface EditMessagePayload {
  roomUuid: string
  messageId: number
  newContent: string
}

interface DeleteMessagePayload {
  roomUuid: string
  messageId: number
}

interface UpdateLanguagePayload {
  roomUuid: string
  language: string
}

interface TypingPayload {
  roomUuid: string
  isTyping: boolean
}

interface SendThreadReplyPayload {
  roomUuid: string
  parentMessageId: number
  content: string
  mentionedUserIds?: number[]
}

interface ToggleReactionPayload {
  roomUuid: string
  messageId: number
  emoji: string
}

interface PinMessagePayload {
  roomUuid: string
  messageId: number
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'chat', path: '/ws' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name)
  private readonly roomUsers = new Map<number, Map<string, RoomUser>>()

  constructor(
    private readonly chatService: ChatService,
    private readonly chatRoomService: ChatRoomService,
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    private readonly messageReactionsService: MessageReactionsService,
    private readonly pinnedMessagesService: PinnedMessagesService,
    private readonly slackChannelsService: SlackChannelsService,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  @WebSocketServer()
  private server: Server

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  broadcastTranslations(
    roomId: number,
    messageId: number,
    translations: Record<string, string>,
  ): void {
    this.server
      .to(`room_${roomId}`)
      .emit('message_translations_ready', { id: messageId, translations })
  }

  broadcastMessage(roomId: number, payload: object): void {
    this.server.to(`room_${roomId}`).emit('message_new', payload)
  }

  handleDisconnect(client: Socket) {
    for (const [roomId, users] of this.roomUsers.entries()) {
      if (!users.has(client.id)) continue

      const user = users.get(client.id)!
      users.delete(client.id)

      if (users.size === 0) {
        this.roomUsers.delete(roomId)
      }

      this.server.to(`room_${roomId}`).emit('user_left', {
        roomId,
        userId: user.userId,
        username: user.username,
      })

      // Mark room as read on disconnect
      this.chatRoomService.markAsRead(roomId, user.userId).catch((error) => {
        this.logger.error('Failed to mark as read on disconnect', error)
        this.errorLogsService.logError({
          message: 'Failed to mark as read on disconnect',
          stackTrace: (error as Error).stack ?? null,
          path: 'chat',
        })
      })
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@MessageBody() payload: JoinRoomPayload, @ConnectedSocket() client: Socket) {
    const { userId, username, avatar, language } = payload
    let roomId: number

    try {
      const room = await this.chatRoomService.findByUuid(payload.roomUuid)
      roomId = room.id

      if (room.visibility === ChatRoomVisibility.PRIVATE || room.type === ChatRoomType.DIRECT) {
        const isMember = await this.chatRoomService.isMember(roomId, userId)

        if (!isMember) {
          client.emit('error', { message: 'This is a private room. You are not a member.' })

          return
        }
      }
    } catch {
      client.emit('error', { message: 'Room not found' })

      return
    }

    const roomKey = `room_${roomId}`
    client.join(roomKey)

    // Join personal notification room for real-time unread updates
    client.join(`user_${userId}`)

    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Map())
    }

    this.roomUsers.get(roomId)!.set(client.id, { userId, username, avatar, language })

    const onlineUsers = Array.from(this.roomUsers.get(roomId)!.values())
    client.emit('room_users', onlineUsers)

    client.to(roomKey).emit('user_joined', { userId, username, avatar, language })

    // Mark room as read when user opens it
    this.chatRoomService.markAsRead(roomId, userId).catch((error) => {
      this.logger.error('Failed to mark as read on join', error)
      this.errorLogsService.logError({
        message: 'Failed to mark as read on join',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
    })
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() payload: LeaveRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)
    if (!room) return

    const roomId = room.id
    const roomKey = `room_${roomId}`
    const users = this.roomUsers.get(roomId)

    if (!users?.has(client.id)) return

    const user = users.get(client.id)!
    users.delete(client.id)

    if (users.size === 0) {
      this.roomUsers.delete(roomId)
    }

    client.leave(roomKey)
    this.server.to(roomKey).emit('user_left', {
      roomId,
      userId: user.userId,
      username: user.username,
    })

    // Mark room as read when user leaves
    this.chatRoomService.markAsRead(roomId, user.userId).catch((error) => {
      this.logger.error('Failed to mark as read on leave', error)
      this.errorLogsService.logError({
        message: 'Failed to mark as read on leave',
        stackTrace: (error as Error).stack ?? null,
        path: 'chat',
      })
    })
  }

  @SubscribeMessage('update_language')
  async handleUpdateLanguage(
    @MessageBody() payload: UpdateLanguagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)
    if (!room) return

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) return

    user.language = payload.language

    this.server.to(`room_${roomId}`).emit('user_updated', {
      userId: user.userId,
      language: payload.language,
    })
  }

  @SubscribeMessage('typing')
  async handleTyping(@MessageBody() payload: TypingPayload, @ConnectedSocket() client: Socket) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)
    if (!room) return

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) return

    // Broadcast to everyone else in the room (not the sender)
    client.to(`room_${roomId}`).emit('typing', {
      username: user.username,
      isTyping: payload.isTyping,
    })
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })

      return
    }

    const roomId = room.id
    const { content } = payload
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })

      return
    }

    if (!content?.trim()) {
      client.emit('error', { message: 'Message content cannot be empty' })

      return
    }

    if (content.trim().length > 2000) {
      client.emit('error', { message: 'Message content cannot exceed 2000 characters' })

      return
    }

    try {
      const result = await this.chatService.sendMessage({
        roomId,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        content: content.trim(),
      })

      this.server.to(`room_${roomId}`).emit('message_new', result)

      // Notify targeted members about new unread message
      this.notifyUnreadUpdate(
        roomId,
        room.uuid,
        user.userId,
        user.username,
        content.substring(0, 100),
        room.name,
        room.type,
        payload.mentionedUserIds,
      )

      // Send mention notifications
      this.notifyMention(room, roomId, user, content.trim(), payload.mentionedUserIds, result)

      // Translate in background — spam/emoji/unknown are filtered inside dispatchTranslation
      this.dispatchTranslation({
        messageId: result.id,
        content: result.content,
        detectedLang: result.detectedLang,
        roomId,
      })
    } catch (error) {
      this.logger.error('Failed to send message', error)
      this.errorLogsService.logError({
        message: `Failed to send message in room ${payload.roomUuid} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      this.slackChannelsService.sendSystemError(
        `[Chat] Failed to send message in room ${payload.roomUuid} by userId=${user.userId}: ${(error as Error).message}`,
      )
      client.emit('error', { message: 'Failed to send message' })
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @MessageBody() payload: EditMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })
      return
    }

    const roomId = room.id
    const { messageId, newContent } = payload
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })

      return
    }

    if (!newContent?.trim()) {
      client.emit('error', { message: 'Message content cannot be empty' })

      return
    }

    if (newContent.trim().length > 2000) {
      client.emit('error', { message: 'Message content cannot exceed 2000 characters' })

      return
    }

    try {
      const result = await this.chatService.editMessage({
        messageId,
        userId: user.userId,
        roomId,
        newContent: newContent.trim(),
        username: user.username,
        avatar: user.avatar,
      })

      this.server.to(`room_${roomId}`).emit('message_edited', result)

      // Translate in background — forceRefresh:true ensures stale cache is never used after edit
      this.dispatchTranslation({
        messageId: result.id,
        content: result.content,
        detectedLang: result.detectedLang,
        roomId,
        forceRefresh: true,
      })
    } catch (error) {
      this.logger.error('Failed to edit message', error)
      this.errorLogsService.logError({
        message: `Failed to edit message ${messageId} in room ${payload.roomUuid} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      this.slackChannelsService.sendSystemError(
        `[Chat] Failed to edit messageId=${messageId} in room ${payload.roomUuid} by userId=${user.userId}: ${(error as Error).message}`,
      )
      const errorMessage = error instanceof Error ? error.message : 'Failed to edit message'
      client.emit('error', { message: errorMessage })
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @MessageBody() payload: DeleteMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })
      return
    }

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })
      return
    }

    try {
      await this.chatService.deleteMessage({
        messageId: payload.messageId,
        userId: user.userId,
      })

      this.server.to(`room_${roomId}`).emit('message_deleted', { messageId: payload.messageId })
    } catch (error) {
      this.logger.error('Failed to delete message', error)
      this.errorLogsService.logError({
        message: `Failed to delete message ${payload.messageId} in room ${payload.roomUuid} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete message'
      client.emit('error', { message: errorMessage })
    }
  }

  @SubscribeMessage('send_thread_reply')
  async handleSendThreadReply(
    @MessageBody() payload: SendThreadReplyPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })

      return
    }

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })

      return
    }

    if (!payload.content?.trim()) {
      client.emit('error', { message: 'Message content cannot be empty' })

      return
    }

    if (payload.content.trim().length > 2000) {
      client.emit('error', { message: 'Message content cannot exceed 2000 characters' })

      return
    }

    try {
      const result = await this.chatService.sendThreadReply({
        roomId,
        parentId: payload.parentMessageId,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        content: payload.content.trim(),
      })

      this.server.to(`room_${roomId}`).emit('thread_reply_new', result)

      // Notify targeted members about new unread message
      this.notifyUnreadUpdate(
        roomId,
        room.uuid,
        user.userId,
        user.username,
        payload.content.trim().substring(0, 100),
        room.name,
        room.type,
        payload.mentionedUserIds,
      )

      // Send mention notifications for thread replies
      this.notifyMention(
        room,
        roomId,
        user,
        payload.content.trim(),
        payload.mentionedUserIds,
        result,
      )

      this.dispatchTranslation({
        messageId: result.id,
        content: result.content,
        detectedLang: result.detectedLang,
        roomId,
      })
    } catch (error) {
      this.logger.error('Failed to send thread reply', error)
      this.errorLogsService.logError({
        message: `Failed to send thread reply in room ${payload.roomUuid} parentId=${payload.parentMessageId} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      this.slackChannelsService.sendSystemError(
        `[Chat] Failed to send thread reply in room ${payload.roomUuid} parentId=${payload.parentMessageId} by userId=${user.userId}: ${(error as Error).message}`,
      )
      client.emit('error', { message: 'Failed to send thread reply' })
    }
  }

  @SubscribeMessage('toggle_reaction')
  async handleToggleReaction(
    @MessageBody() payload: ToggleReactionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })

      return
    }

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })
      return
    }

    try {
      const reactions = await this.messageReactionsService.toggle(
        payload.messageId,
        user.userId,
        payload.emoji,
      )

      this.server
        .to(`room_${roomId}`)
        .emit('reaction_updated', { messageId: payload.messageId, reactions })
    } catch (error) {
      this.logger.error('Failed to toggle reaction', error)
      this.errorLogsService.logError({
        message: `Failed to toggle reaction on message ${payload.messageId} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      client.emit('error', { message: 'Failed to toggle reaction' })
    }
  }

  @SubscribeMessage('pin_message')
  async handlePinMessage(
    @MessageBody() payload: PinMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })

      return
    }

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })

      return
    }

    try {
      await this.pinnedMessagesService.pin(roomId, payload.messageId, user.userId)

      this.server.to(`room_${roomId}`).emit('message_pinned', {
        messageId: payload.messageId,
        pinnedByUserId: user.userId,
        pinnedByName: user.username,
      })
    } catch (error) {
      this.logger.error('Failed to pin message', error)
      this.errorLogsService.logError({
        message: `Failed to pin message ${payload.messageId} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      client.emit('error', { message: 'Failed to pin message' })
    }
  }

  @SubscribeMessage('unpin_message')
  async handleUnpinMessage(
    @MessageBody() payload: PinMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.chatRoomService.findByUuid(payload.roomUuid).catch(() => null)

    if (!room) {
      client.emit('error', { message: 'Room not found' })

      return
    }

    const roomId = room.id
    const users = this.roomUsers.get(roomId)
    const user = users?.get(client.id)

    if (!user) {
      client.emit('error', { message: 'You are not in this room' })

      return
    }

    const admin = await this.chatRoomService.isAdmin(roomId, user.userId)

    if (!admin) {
      client.emit('error', { message: 'Only room admins can unpin messages' })

      return
    }

    try {
      await this.pinnedMessagesService.unpin(roomId, payload.messageId)

      this.server.to(`room_${roomId}`).emit('message_unpinned', {
        messageId: payload.messageId,
      })
    } catch (error) {
      this.logger.error('Failed to unpin message', error)
      this.errorLogsService.logError({
        message: `Failed to unpin message ${payload.messageId} by userId=${user.userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `chat_room_${payload.roomUuid}`,
        userId: user.userId,
      })
      client.emit('error', { message: 'Failed to unpin message' })
    }
  }

  /**
   * Returns user IDs currently connected to a room.
   */
  /**
   * Translates a message in the background and broadcasts the result to the room.
   * Guards against spam and non-translatable content before spawning the AI call.
   */
  private dispatchTranslation(parameters: {
    messageId: number
    content: string
    detectedLang: string
    roomId: number
    forceRefresh?: boolean
  }): void {
    // Skip translation for spam, emoji-only, unknown language, or short messages
    if (
      parameters.detectedLang === 'unknown' ||
      !this.chatService.isTranslatableForDispatch(parameters.content)
    ) {
      return
    }

    this.chatService
      .translateMessage({
        messageId: parameters.messageId,
        content: parameters.content,
        detectedLang: parameters.detectedLang,
        roomId: parameters.roomId,
        forceRefresh: parameters.forceRefresh,
        onChunk: (lang, chunk) => {
          this.server
            .to(`room_${parameters.roomId}`)
            .emit('message_translation_stream', { id: parameters.messageId, lang, chunk })
        },
      })
      .then((translations) => {
        if (Object.keys(translations).length > 0) {
          this.server
            .to(`room_${parameters.roomId}`)
            .emit('message_translations_ready', { id: parameters.messageId, translations })
        }
      })
      .catch((error) => {
        this.logger.error('Background translation failed', error)
        this.errorLogsService.logError({
          message: 'Background translation failed',
          stackTrace: (error as Error).stack ?? null,
          path: 'chat',
        })
      })
  }

  private getOnlineUserIdsInRoom(roomId: number): Set<number> {
    const users = this.roomUsers.get(roomId)
    if (!users) return new Set()

    return new Set(Array.from(users.values()).map((user) => user.userId))
  }

  /**
   * Returns true when a user has no active socket connection to the server.
   */
  private isUserOffline(userId: number): boolean {
    const adapter = this.server.adapter as unknown as { rooms: Map<string, Set<string>> }
    const userRoom = adapter.rooms.get(`user_${userId}`)

    return !userRoom || userRoom.size === 0
  }

  /**
   * Sends unread_update socket event to targeted members not in the room.
   * Also sends FCM push to members with no active socket connection.
   * DIRECT rooms: notify the other member.
   * CHANNEL rooms: only notify @mentioned users.
   * Fire-and-forget — does not block message sending.
   */
  private notifyUnreadUpdate(
    roomId: number,
    roomUuid: string,
    senderId: number,
    senderName: string,
    messagePreview: string,
    roomName: string,
    roomType: ChatRoomType,
    mentionedUserIds?: number[],
  ): void {
    this.chatRoomService
      .getMemberUserIds(roomId)
      .then(async (memberUserIds) => {
        const onlineInRoom = this.getOnlineUserIdsInRoom(roomId)
        const offlineUserIds: number[] = []

        // DIRECT: notify other member. CHANNEL: only notify mentioned users.
        const targetUserIds =
          roomType === ChatRoomType.DIRECT
            ? memberUserIds.filter((id) => id !== senderId)
            : (mentionedUserIds ?? []).filter((id) => id !== senderId)

        for (const targetUserId of targetUserIds) {
          if (onlineInRoom.has(targetUserId)) continue

          // Send socket event to members connected but viewing other rooms
          this.server.to(`user_${targetUserId}`).emit('unread_update', { roomUuid })

          // Collect users with no socket connection at all for FCM push
          if (this.isUserOffline(targetUserId)) {
            offlineUserIds.push(targetUserId)
          }
        }

        this.logger.debug(`[FCM] offlineUserIds: ${offlineUserIds}`)

        if (offlineUserIds.length > 0) {
          const tokenMap = await this.usersService.getFcmTokensForUsers(offlineUserIds)
          const tokens = Array.from(tokenMap.values())
          this.logger.debug(`[FCM] token count: ${tokens.length}`)
          await this.firebaseService.sendToDevices(
            tokens,
            `${senderName} in ${roomName}`,
            messagePreview,
            { roomUuid, url: `/chat/${roomUuid}` },
          )
        }
      })
      .catch((error) => {
        this.logger.error('Failed to notify unread update', error)
        this.errorLogsService.logError({
          message: 'Failed to notify unread update',
          stackTrace: (error as Error).stack ?? null,
          path: 'chat',
        })
      })
  }

  /**
   * Sends mention_notification socket event and FCM push to mentioned users.
   * For direct rooms: notifies the other member.
   * For channels: notifies only the @mentioned users.
   * Fire-and-forget — does not block message sending.
   */
  private notifyMention(
    room: { uuid: string; name: string; type: ChatRoomType },
    roomId: number,
    sender: RoomUser,
    contentPreview: string,
    mentionedUserIds: number[] | undefined,
    messageData?: { id: number; parentId: number | null; createdAt: Date },
  ): void {
    const socketPayload = {
      roomUuid: room.uuid,
      roomName: room.name,
      roomType: room.type,
      senderId: sender.userId,
      senderName: sender.username,
      senderAvatar: sender.avatar,
      contentPreview: contentPreview.substring(0, 100),
      messageId: messageData?.id,
      messageParentId: messageData?.parentId ?? null,
      messageCreatedAt: messageData?.createdAt,
    }

    const notifyUser = async (userId: number) => {
      this.server.to(`user_${userId}`).emit('mention_notification', socketPayload)

      if (this.isUserOffline(userId)) {
        const tokenMap = await this.usersService.getFcmTokensForUsers([userId])
        const token = tokenMap.get(userId)

        if (token) {
          await this.firebaseService.sendToDevice(
            token,
            sender.username,
            contentPreview.substring(0, 100),
            { roomUuid: room.uuid, url: `/chat/${room.uuid}` },
          )
        }
      }
    }

    if (room.type === ChatRoomType.DIRECT) {
      this.chatRoomService
        .getMemberUserIds(roomId)
        .then(async (memberUserIds) => {
          for (const memberId of memberUserIds) {
            if (memberId !== sender.userId) {
              await notifyUser(memberId)
            }
          }
        })
        .catch((error) => {
          this.logger.error('Failed to notify direct room mention', error)
          this.errorLogsService.logError({
            message: 'Failed to notify direct room mention',
            stackTrace: (error as Error).stack ?? null,
            path: 'chat',
          })
        })
    } else if (mentionedUserIds && mentionedUserIds.length > 0) {
      Promise.all(
        mentionedUserIds.filter((id) => id !== sender.userId).map((id) => notifyUser(id)),
      ).catch((error) => {
        this.logger.error('Failed to notify channel mention', error)
        this.errorLogsService.logError({
          message: 'Failed to notify channel mention',
          stackTrace: (error as Error).stack ?? null,
          path: 'chat',
        })
      })
    }
  }
}
