import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PinnedMessage } from './entities/pinned_message.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

export interface PinnedMessageWithDetails {
  id: number
  messageId: number
  roomId: number
  pinnedByUserId: number
  pinnedByName: string
  content: string
  userId: number
  username: string
  avatar: string | null
  createdAt: Date
  pinnedAt: Date
}

@Injectable()
export class PinnedMessagesService {
  private readonly logger = new Logger(PinnedMessagesService.name)

  constructor(
    private readonly errorLogsService: ErrorLogsService,
    @InjectRepository(PinnedMessage)
    private readonly pinnedMessageRepository: Repository<PinnedMessage>,
  ) {}

  /**
   * Pins a message in a room. Idempotent — silently returns existing if already pinned.
   */
  async pin(roomId: number, messageId: number, pinnedByUserId: number): Promise<PinnedMessage> {
    try {
      const existing = await this.pinnedMessageRepository.findOneBy({
        room_id: roomId,
        message_id: messageId,
      })

      if (existing) return existing

      const entry = this.pinnedMessageRepository.create({
        room_id: roomId,
        message_id: messageId,
        pinned_by_user_id: pinnedByUserId,
        created_at: new Date(),
      })

      return this.pinnedMessageRepository.save(entry)
    } catch (error) {
      this.logger.error('Failed to pin message', error)
      this.errorLogsService.logError({
        message: 'Failed to pin message',
        stackTrace: (error as Error).stack ?? null,
        path: 'pinned_messages',
      })
      throw error
    }
  }

  /**
   * Unpins a message from a room.
   */
  async unpin(roomId: number, messageId: number): Promise<void> {
    try {
      await this.pinnedMessageRepository.delete({ room_id: roomId, message_id: messageId })
    } catch (error) {
      this.logger.error('Failed to unpin message', error)
      this.errorLogsService.logError({
        message: 'Failed to unpin message',
        stackTrace: (error as Error).stack ?? null,
        path: 'pinned_messages',
      })
      throw error
    }
  }

  /**
   * Returns all pinned messages for a room with full message and user details.
   */
  async findByRoom(roomId: number): Promise<PinnedMessageWithDetails[]> {
    try {
      const results = await this.pinnedMessageRepository.query(
        `SELECT
           pm.id,
           pm.message_id AS messageId,
           pm.room_id AS roomId,
           pm.pinned_by_user_id AS pinnedByUserId,
           CONCAT(pinner.first_name, ' ', pinner.last_name) AS pinnedByName,
           m.content,
           m.user_id AS userId,
           CONCAT(author.first_name, ' ', author.last_name) AS username,
           author.avatar,
           m.created_at AS createdAt,
           pm.created_at AS pinnedAt
         FROM pinned_messages pm
         JOIN messages m ON m.id = pm.message_id
         JOIN users author ON author.id = m.user_id
         JOIN users pinner ON pinner.id = pm.pinned_by_user_id
         WHERE pm.room_id = ?
         ORDER BY pm.created_at DESC`,
        [roomId],
      )

      return results
    } catch (error) {
      this.logger.error('Failed to find pinned messages by room', error)
      this.errorLogsService.logError({
        message: 'Failed to find pinned messages by room',
        stackTrace: (error as Error).stack ?? null,
        path: 'pinned_messages',
      })
      throw error
    }
  }

  /**
   * Checks if a message is pinned in a room.
   */
  async isPinned(roomId: number, messageId: number): Promise<boolean> {
    try {
      const entry = await this.pinnedMessageRepository.findOneBy({
        room_id: roomId,
        message_id: messageId,
      })

      return !!entry
    } catch (error) {
      this.logger.error('Failed to check if message is pinned', error)
      this.errorLogsService.logError({
        message: 'Failed to check if message is pinned',
        stackTrace: (error as Error).stack ?? null,
        path: 'pinned_messages',
      })
      throw error
    }
  }
}
