import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { instanceToPlain } from 'class-transformer'
import { ChatRoom, ChatRoomType, ChatRoomVisibility } from './entities/chat-room.entity'
import { ChatRoomMember, ChatRoomMemberRole } from './entities/chat-room-member.entity'
import { Message } from '../messages/entities/message.entity'
import { CreateChatRoomDto } from './dto/create-chat-room.dto'
import { UpdateChatRoomDto } from './dto/update-chat-room.dto'
import { InviteUserDto } from './dto/invite-user.dto'

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatRoomMember)
    private readonly chatRoomMemberRepository: Repository<ChatRoomMember>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Creates a new chat room and auto-joins the creator as admin.
   * For direct rooms: forces private visibility, requires targetUserId,
   * and prevents duplicate 1-1 rooms between the same user pair.
   */
  async create(creatorId: number, dto: CreateChatRoomDto): Promise<ChatRoom> {
    const isDirect = (dto.type ?? ChatRoomType.CHANNEL) === ChatRoomType.DIRECT

    if (isDirect) {
      if (!dto.targetUserId) {
        throw new BadRequestException('Direct rooms require a target user')
      }

      if (dto.targetUserId === creatorId) {
        throw new BadRequestException('Cannot create a direct room with yourself')
      }

      // Check if a direct room already exists between these two users
      const existingRoom = await this.findDirectRoomBetweenUsers(creatorId, dto.targetUserId)

      if (existingRoom) {
        throw new BadRequestException('A direct room already exists between you and this user')
      }
    }

    // Auto-generate name for direct rooms if not provided
    let roomName = dto.name

    if (isDirect && !roomName) {
      const targetUser = await this.chatRoomMemberRepository.query(
        `SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM users WHERE id = ?`,
        [dto.targetUserId],
      )
      roomName = `DM - ${targetUser[0]?.full_name ?? 'Unknown'}`
    }

    const room = this.chatRoomRepository.create({
      name: roomName,
      description: dto.description,
      type: dto.type ?? ChatRoomType.CHANNEL,
      visibility: isDirect
        ? ChatRoomVisibility.PRIVATE
        : (dto.visibility ?? ChatRoomVisibility.PUBLIC),
      creator_id: creatorId,
    })
    const saved = await this.chatRoomRepository.save(room)

    await this.chatRoomMemberRepository.save({
      room_id: saved.id,
      user_id: creatorId,
      role: ChatRoomMemberRole.ADMIN,
    })

    // For direct rooms, auto-add the target user as member
    if (isDirect && dto.targetUserId) {
      await this.chatRoomMemberRepository.save({
        room_id: saved.id,
        user_id: dto.targetUserId,
        role: ChatRoomMemberRole.MEMBER,
      })
    }

    // For channel rooms, add invited members
    if (!isDirect) {
      const userIds = new Set<number>()

      // Add individually selected users
      if (dto.memberUserIds) {
        for (const userId of dto.memberUserIds) {
          if (userId !== creatorId) userIds.add(userId)
        }
      }

      // Resolve group members and merge
      if (dto.groupIds && dto.groupIds.length > 0) {
        const groupUserRows = await this.chatRoomMemberRepository.query(
          `SELECT DISTINCT user_id FROM user_groups WHERE group_id IN (?)`,
          [dto.groupIds],
        )

        for (const row of groupUserRows) {
          if (row.user_id !== creatorId) userIds.add(row.user_id)
        }
      }

      if (userIds.size > 0) {
        const members = Array.from(userIds).map((userId) => ({
          room_id: saved.id,
          user_id: userId,
          role: ChatRoomMemberRole.MEMBER,
        }))
        await this.chatRoomMemberRepository.save(members)
      }
    }

    return saved
  }

  /**
   * Finds an existing direct room between two users (if any).
   */
  private async findDirectRoomBetweenUsers(
    userId1: number,
    userId2: number,
  ): Promise<ChatRoom | null> {
    // Find all direct rooms where user1 is a member
    const user1Rooms = await this.chatRoomMemberRepository
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.room', 'room', 'room.type = :type', {
        type: ChatRoomType.DIRECT,
      })
      .where('member.user_id = :userId', { userId: userId1 })
      .getMany()

    // Check if user2 is also a member of any of those rooms
    for (const membership of user1Rooms) {
      const user2Membership = await this.chatRoomMemberRepository.findOneBy({
        room_id: membership.room_id,
        user_id: userId2,
      })

      if (user2Membership) {
        return membership.room
      }
    }

    return null
  }

  /**
   * Returns all rooms the user is a member of.
   */
  async findMyRooms(userId: number) {
    const memberships = await this.chatRoomMemberRepository.find({
      where: { user_id: userId },
      relations: ['room', 'room.creator'],
    })

    const rooms = memberships.map((membership) => membership.room!).filter(Boolean)

    // Fetch member counts for all rooms in one query
    const roomIds = rooms.map((room) => room.id)
    const memberCountMap = new Map<number, number>()

    if (roomIds.length > 0) {
      const countRows: { room_id: number; count: string }[] =
        await this.chatRoomMemberRepository.query(
          `SELECT room_id, COUNT(*) as count FROM chat_room_members WHERE room_id IN (${roomIds.map(() => '?').join(',')}) GROUP BY room_id`,
          roomIds,
        )

      for (const row of countRows) {
        memberCountMap.set(Number(row.room_id), Number(row.count))
      }
    }

    // For direct rooms, attach the other user as direct_user
    const directRoomIds = rooms
      .filter((room) => room.type === ChatRoomType.DIRECT)
      .map((room) => room.id)

    const directUserMap = new Map<
      number,
      { id: number; full_name: string; email: string; avatar?: string }
    >()

    if (directRoomIds.length > 0) {
      const allMembers = await this.chatRoomMemberRepository.find({
        where: directRoomIds.map((roomId) => ({ room_id: roomId })),
        relations: ['user'],
      })

      for (const member of allMembers) {
        if (!member.user || member.user.id === userId) continue
        directUserMap.set(member.room_id, {
          id: member.user.id,
          full_name: `${member.user.first_name} ${member.user.last_name}`,
          email: member.user.email,
          avatar: member.user.avatar,
        })
      }
    }

    const previewMemberMap = await this.fetchPreviewMembers(roomIds)

    // Convert to plain objects and attach direct_user + member_count + preview_members
    return rooms.map((room) => {
      const plain = instanceToPlain(room) as Record<string, unknown>

      if (room.type === ChatRoomType.DIRECT) {
        plain.direct_user = directUserMap.get(room.id) ?? null
      }

      plain.member_count = memberCountMap.get(room.id) ?? 0
      plain.preview_members = previewMemberMap.get(room.id) ?? []

      return plain
    })
  }

  /**
   * Returns all public rooms (for discovery).
   */
  async findPublicRooms() {
    const rooms = await this.chatRoomRepository.find({
      where: { visibility: ChatRoomVisibility.PUBLIC },
      relations: ['creator'],
      order: { created_at: 'DESC' },
    })

    if (rooms.length === 0) return rooms

    const roomIds = rooms.map((room) => room.id)
    const countRows: { room_id: number; count: string }[] =
      await this.chatRoomMemberRepository.query(
        `SELECT room_id, COUNT(*) as count FROM chat_room_members WHERE room_id IN (${roomIds.map(() => '?').join(',')}) GROUP BY room_id`,
        roomIds,
      )

    const memberCountMap = new Map(countRows.map((row) => [Number(row.room_id), Number(row.count)]))
    const previewMemberMap = await this.fetchPreviewMembers(roomIds)

    return rooms.map((room) => ({
      ...instanceToPlain(room),
      member_count: memberCountMap.get(room.id) ?? 0,
      preview_members: previewMemberMap.get(room.id) ?? [],
    }))
  }

  /**
   * Returns a single room by ID.
   */
  async findOne(roomId: number): Promise<ChatRoom> {
    const room = await this.chatRoomRepository.findOneBy({ id: roomId })
    if (!room) throw new NotFoundException('Chat room not found')

    return room
  }

  /**
   * Returns a single room by UUID.
   * For direct rooms, attaches the other user as direct_user.
   */
  async findByUuid(uuid: string, userId?: number): Promise<ChatRoom> {
    const room = await this.chatRoomRepository.findOne({
      where: { uuid },
      relations: ['creator'],
    })
    if (!room) throw new NotFoundException('Chat room not found')

    if (room.type === ChatRoomType.DIRECT) {
      const allMembers = await this.chatRoomMemberRepository.find({
        where: { room_id: room.id },
        relations: ['user'],
      })

      const otherMember = userId
        ? allMembers.find((member) => member.user && member.user.id !== userId)
        : allMembers.find((member) => member.user && member.user.id !== room.creator_id)

      if (otherMember?.user) {
        room.direct_user = {
          id: otherMember.user.id,
          full_name: `${otherMember.user.first_name} ${otherMember.user.last_name}`,
          email: otherMember.user.email,
          avatar: otherMember.user.avatar,
        }
      }
    }

    return room
  }

  /**
   * Updates a chat room. Only admins can update.
   */
  async update(roomId: number, userId: number, dto: UpdateChatRoomDto): Promise<ChatRoom> {
    await this.requireAdmin(roomId, userId)
    await this.chatRoomRepository.update({ id: roomId }, { ...dto })

    return this.findOne(roomId)
  }

  /**
   * Soft-deletes a chat room. Only admins can delete.
   */
  async remove(roomId: number, userId: number): Promise<void> {
    await this.requireAdmin(roomId, userId)
    await this.deleteRoom(roomId)
  }

  /**
   * Adds a user to a room as a regular member.
   * Private rooms cannot be joined directly — requires an invitation from admin.
   */
  async join(roomId: number, userId: number): Promise<ChatRoomMember> {
    const room = await this.findOne(roomId)

    if (room.visibility === ChatRoomVisibility.PRIVATE) {
      throw new ForbiddenException('This is a private room. You must be invited to join.')
    }

    const existing = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: userId,
    })
    if (existing) return existing

    const member = this.chatRoomMemberRepository.create({
      room_id: roomId,
      user_id: userId,
      role: ChatRoomMemberRole.MEMBER,
    })

    return this.chatRoomMemberRepository.save(member)
  }

  /**
   * Invites a user to a private room. Only room admins can invite.
   */
  async invite(roomId: number, adminId: number, dto: InviteUserDto): Promise<ChatRoomMember> {
    await this.findOne(roomId)
    await this.requireAdmin(roomId, adminId)

    const existing = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: dto.user_id,
    })
    if (existing) return existing

    const member = this.chatRoomMemberRepository.create({
      room_id: roomId,
      user_id: dto.user_id,
      role: ChatRoomMemberRole.MEMBER,
    })

    return this.chatRoomMemberRepository.save(member)
  }

  /**
   * Removes a user from a room.
   * If no members remain, soft-deletes the room.
   */
  async leave(roomId: number, userId: number): Promise<{ roomDeleted: boolean }> {
    await this.chatRoomMemberRepository.delete({ room_id: roomId, user_id: userId })

    const remainingMembers = await this.chatRoomMemberRepository.count({
      where: { room_id: roomId },
    })

    if (remainingMembers === 0) {
      await this.deleteRoom(roomId)
      return { roomDeleted: true }
    }

    return { roomDeleted: false }
  }

  /**
   * Removes a member from a room. Only room admins can do this.
   * Admins cannot remove themselves — use leave() instead.
   * If no members remain after removal, the room is deleted.
   */
  async removeMember(
    roomId: number,
    adminId: number,
    targetUserId: number,
  ): Promise<{ roomDeleted: boolean }> {
    await this.requireAdmin(roomId, adminId)

    if (targetUserId === adminId) {
      throw new BadRequestException('Admins cannot remove themselves. Use leave instead.')
    }

    const targetMember = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: targetUserId,
    })

    if (!targetMember) {
      throw new NotFoundException('User is not a member of this room')
    }

    await this.chatRoomMemberRepository.delete({ room_id: roomId, user_id: targetUserId })

    const remainingMembers = await this.chatRoomMemberRepository.count({
      where: { room_id: roomId },
    })

    if (remainingMembers === 0) {
      await this.deleteRoom(roomId)
      return { roomDeleted: true }
    }

    return { roomDeleted: false }
  }

  /**
   * Returns all members of a room with user info.
   */
  async getMembers(roomId: number): Promise<ChatRoomMember[]> {
    return this.chatRoomMemberRepository.find({
      where: { room_id: roomId },
      relations: ['user'],
    })
  }

  /**
   * Returns user IDs of all members in a room.
   */
  async getMemberUserIds(roomId: number): Promise<number[]> {
    const members = await this.chatRoomMemberRepository.find({
      where: { room_id: roomId },
      select: ['user_id'],
    })

    return members.map((member) => member.user_id)
  }

  /**
   * Checks if a user is a member of a room.
   */
  async isMember(roomId: number, userId: number): Promise<boolean> {
    const member = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: userId,
    })

    return !!member
  }

  /**
   * Checks if a user is an admin of a room.
   */
  async isAdmin(roomId: number, userId: number): Promise<boolean> {
    const member = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: userId,
    })

    return member?.role === ChatRoomMemberRole.ADMIN
  }

  /**
   * Returns unread message counts for all rooms the user is a member of.
   * Keyed by room UUID for client convenience.
   */
  async getUnreadCounts(userId: number): Promise<Record<string, number>> {
    const results = await this.chatRoomMemberRepository.query(
      `SELECT cr.uuid AS roomUuid, CAST(COUNT(m.id) AS UNSIGNED) AS unreadCount
       FROM chat_room_members crm
       JOIN chat_rooms cr ON cr.id = crm.room_id
       LEFT JOIN messages m ON m.room_id = cr.id
         AND m.user_id != ?
         AND (crm.last_read_at IS NULL OR m.created_at > crm.last_read_at)
       WHERE crm.user_id = ?
         AND cr.deleted_at IS NULL
       GROUP BY cr.uuid`,
      [userId, userId],
    )

    const counts: Record<string, number> = {}

    for (const row of results) {
      counts[row.roomUuid] = Number(row.unreadCount)
    }

    return counts
  }

  /**
   * Marks all messages in a room as read for the given user.
   */
  async markAsRead(roomId: number, userId: number): Promise<void> {
    await this.chatRoomMemberRepository.update(
      { room_id: roomId, user_id: userId },
      { last_read_at: new Date() },
    )
  }

  /**
   * Returns the last_read_at timestamp for a user in a room.
   */
  async getLastReadAt(roomId: number, userId: number): Promise<Date | null> {
    const member = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: userId,
    })

    return member?.last_read_at ?? null
  }

  /**
   * Returns recent read messages from other users across all rooms.
   * Returns only the latest top-level message per room (excludes thread replies).
   */
  async getRecentReadMessages(userId: number, limit = 20): Promise<UnreadMessageResult[]> {
    const results = await this.chatRoomMemberRepository.query(
      `SELECT m.id, m.content, m.created_at, m.parent_id AS parentId,
              cr.uuid AS roomUuid, cr.name AS roomName, cr.type AS roomType,
              m.user_id AS senderId,
              CONCAT(u.first_name, ' ', u.last_name) AS senderName,
              u.avatar AS senderAvatar
       FROM chat_room_members crm
       JOIN chat_rooms cr ON cr.id = crm.room_id
       JOIN messages m ON m.room_id = cr.id
         AND m.user_id != ?
         AND m.parent_id IS NULL
         AND crm.last_read_at IS NOT NULL
         AND m.created_at <= crm.last_read_at
       JOIN users u ON u.id = m.user_id
       WHERE crm.user_id = ?
         AND cr.deleted_at IS NULL
         AND m.id = (
           SELECT MAX(m2.id) FROM messages m2
           WHERE m2.room_id = cr.id
             AND m2.user_id != ?
             AND m2.parent_id IS NULL
             AND crm.last_read_at IS NOT NULL
             AND m2.created_at <= crm.last_read_at
         )
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [userId, userId, userId, limit],
    )

    return results.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      content: String(row.content),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
      parentId: row.parentId ? Number(row.parentId) : null,
      roomUuid: String(row.roomUuid),
      roomName: String(row.roomName),
      roomType: String(row.roomType),
      senderId: Number(row.senderId),
      senderName: String(row.senderName),
      senderAvatar: (row.senderAvatar as string) ?? null,
    }))
  }

  /**
   * Returns recent unread messages from other users across all rooms.
   * Returns only the latest top-level message per room (excludes thread replies).
   */
  async getUnreadMessages(userId: number, limit = 20): Promise<UnreadMessageResult[]> {
    const results = await this.chatRoomMemberRepository.query(
      `SELECT m.id, m.content, m.created_at, m.parent_id AS parentId,
              cr.uuid AS roomUuid, cr.name AS roomName, cr.type AS roomType,
              m.user_id AS senderId,
              CONCAT(u.first_name, ' ', u.last_name) AS senderName,
              u.avatar AS senderAvatar
       FROM chat_room_members crm
       JOIN chat_rooms cr ON cr.id = crm.room_id
       JOIN messages m ON m.room_id = cr.id
         AND m.user_id != ?
         AND m.parent_id IS NULL
         AND (crm.last_read_at IS NULL OR m.created_at > crm.last_read_at)
       JOIN users u ON u.id = m.user_id
       WHERE crm.user_id = ?
         AND cr.deleted_at IS NULL
         AND m.id = (
           SELECT MAX(m2.id) FROM messages m2
           WHERE m2.room_id = cr.id
             AND m2.user_id != ?
             AND m2.parent_id IS NULL
             AND (crm.last_read_at IS NULL OR m2.created_at > crm.last_read_at)
         )
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [userId, userId, userId, limit],
    )

    return results.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      content: String(row.content),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
      parentId: row.parentId ? Number(row.parentId) : null,
      roomUuid: String(row.roomUuid),
      roomName: String(row.roomName),
      roomType: String(row.roomType),
      senderId: Number(row.senderId),
      senderName: String(row.senderName),
      senderAvatar: (row.senderAvatar as string) ?? null,
    }))
  }

  /**
   * Deletes a room: hard delete if no messages, soft delete otherwise.
   */
  private async deleteRoom(roomId: number): Promise<void> {
    const messageCount = await this.messageRepository.count({
      where: { room_id: roomId },
    })

    if (messageCount === 0) {
      await this.chatRoomMemberRepository.delete({ room_id: roomId })
      await this.chatRoomRepository.delete({ id: roomId })
    } else {
      await this.chatRoomRepository.softDelete({ id: roomId })
    }
  }

  /**
   * Fetches up to 4 preview members (id, full_name, avatar) for each room.
   * Returns a map keyed by room_id.
   */
  private async fetchPreviewMembers(
    roomIds: number[],
  ): Promise<Map<number, Array<{ id: number; full_name: string; avatar?: string }>>> {
    if (roomIds.length === 0) return new Map()

    const rows: Array<{ room_id: number; id: number; full_name: string; avatar: string | null }> =
      await this.chatRoomMemberRepository.query(
        `SELECT t.room_id, t.id, t.full_name, t.avatar
         FROM (
           SELECT crm.room_id,
                  u.id,
                  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                  u.avatar,
                  ROW_NUMBER() OVER (PARTITION BY crm.room_id ORDER BY crm.joined_at ASC) AS rn
           FROM chat_room_members crm
           JOIN users u ON u.id = crm.user_id
           WHERE crm.room_id IN (${roomIds.map(() => '?').join(',')})
         ) t
         WHERE t.rn <= 4`,
        roomIds,
      )

    const map = new Map<number, Array<{ id: number; full_name: string; avatar?: string }>>()

    for (const row of rows) {
      const roomId = Number(row.room_id)
      if (!map.has(roomId)) map.set(roomId, [])
      map.get(roomId)!.push({
        id: Number(row.id),
        full_name: String(row.full_name),
        avatar: row.avatar ?? undefined,
      })
    }

    return map
  }

  /**
   * Throws if user is not an admin of the room.
   */
  private async requireAdmin(roomId: number, userId: number): Promise<void> {
    const member = await this.chatRoomMemberRepository.findOneBy({
      room_id: roomId,
      user_id: userId,
    })

    if (!member || member.role !== ChatRoomMemberRole.ADMIN) {
      throw new ForbiddenException('Only room admins can perform this action')
    }
  }
}

export interface UnreadMessageResult {
  id: number
  content: string
  createdAt: Date
  parentId: number | null
  roomUuid: string
  roomName: string
  roomType: string
  senderId: number
  senderName: string
  senderAvatar: string | null
}
