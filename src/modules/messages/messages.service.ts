import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Message } from './entities/message.entity'
import { MessageReactionsService } from '@/modules/message_reactions/message-reactions.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name)

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly messageReactionsService: MessageReactionsService,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  async create(data: {
    roomId: number
    userId: number
    content: string
    detectedLang: string
    parentId?: number | null
  }): Promise<Message> {
    try {
      const now = new Date()
      const message = this.messageRepository.create({
        room_id: data.roomId,
        user_id: data.userId,
        content: data.content,
        detected_lang: data.detectedLang,
        parent_id: data.parentId ?? null,
        created_at: now,
        updated_at: now,
      })

      return this.messageRepository.save(message)
    } catch (error) {
      this.logger.error('Failed to create message', error)
      this.errorLogsService.logError({
        message: 'Failed to create message',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }

  async findOne(id: number): Promise<Message | null> {
    return this.messageRepository.findOneBy({ id })
  }

  async findByRoom(
    roomId: number,
    cursor?: number,
    limit = 50,
  ): Promise<{ messages: MessageWithTranslation[]; nextCursor: number | null }> {
    try {
      const cursorValue = cursor ?? null

      const results = await this.messageRepository.query(
        `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as username, u.avatar, u.preferred_language as language, tc.translations,
                (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id AND r.is_deleted = 0) as reply_count
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN translation_cache tc ON tc.message_id = m.id
         WHERE m.room_id = ?
           AND m.parent_id IS NULL
           AND m.is_deleted = 0
           AND (? IS NULL OR m.id < ?)
         ORDER BY m.id DESC
         LIMIT ?`,
        [roomId, cursorValue, cursorValue, limit],
      )

      for (const row of results) {
        if (typeof row.translations === 'string') {
          try {
            row.translations = JSON.parse(row.translations)
          } catch {
            row.translations = {}
          }
        }
      }

      const nextCursor = results.length < limit ? null : results[results.length - 1].id
      const messages = results.reverse()

      // Attach grouped reactions and reply participants
      const messageIds = messages.map((message: MessageWithTranslation) => message.id)
      const reactionsMap = await this.messageReactionsService.getGroupedForMessages(messageIds)
      const participantsMap = await this.fetchReplyParticipants(messageIds)

      for (const message of messages) {
        message.reactions = reactionsMap.get(message.id) ?? []
        message.reply_participants = participantsMap.get(message.id) ?? []
      }

      return { messages, nextCursor }
    } catch (error) {
      this.logger.error('Failed to find messages by room', error)
      this.errorLogsService.logError({
        message: 'Failed to find messages by room',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }

  async findByThread(parentMessageId: number): Promise<MessageWithTranslation[]> {
    try {
      const results = await this.messageRepository.query(
        `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as username, u.avatar, u.preferred_language as language, tc.translations
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN translation_cache tc ON tc.message_id = m.id
         WHERE m.parent_id = ?
           AND m.is_deleted = 0
         ORDER BY m.id ASC`,
        [parentMessageId],
      )

      for (const row of results) {
        if (typeof row.translations === 'string') {
          try {
            row.translations = JSON.parse(row.translations)
          } catch {
            row.translations = {}
          }
        }
      }

      // Attach grouped reactions
      const messageIds = results.map((message: MessageWithTranslation) => message.id)
      const reactionsMap = await this.messageReactionsService.getGroupedForMessages(messageIds)

      for (const message of results) {
        message.reactions = reactionsMap.get(message.id) ?? []
      }

      return results
    } catch (error) {
      this.logger.error('Failed to find messages by thread', error)
      this.errorLogsService.logError({
        message: 'Failed to find messages by thread',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }

  /**
   * Returns up to 3 distinct reply participants per message.
   * Uses DENSE_RANK() to rank unique users within each parent message.
   */
  private async fetchReplyParticipants(
    messageIds: number[],
  ): Promise<Map<number, Array<{ userId: number; username: string; avatar: string }>>> {
    if (messageIds.length === 0) return new Map()

    try {
      const rows: Array<{
        message_id: number
        id: number
        username: string
        avatar: string | null
      }> = await this.messageRepository.query(
        `SELECT t.message_id, t.id, t.username, t.avatar
         FROM (
           SELECT r.parent_id AS message_id,
                  u.id,
                  CONCAT(u.first_name, ' ', u.last_name) AS username,
                  u.avatar,
                  DENSE_RANK() OVER (PARTITION BY r.parent_id ORDER BY u.id) AS dr
           FROM messages r
           JOIN users u ON r.user_id = u.id
           WHERE r.parent_id IN (${messageIds.map(() => '?').join(',')})
           GROUP BY r.parent_id, u.id, u.first_name, u.last_name, u.avatar
         ) t
         WHERE t.dr <= 3`,
        messageIds,
      )

      const map = new Map<number, Array<{ userId: number; username: string; avatar: string }>>()

      for (const row of rows) {
        const messageId = Number(row.message_id)
        if (!map.has(messageId)) map.set(messageId, [])
        map.get(messageId)!.push({
          userId: Number(row.id),
          username: String(row.username),
          avatar: row.avatar ?? '',
        })
      }

      return map
    } catch (error) {
      this.logger.error('Failed to fetch reply participants', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch reply participants',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }

  /**
   * Soft-deletes a message by setting is_deleted = true.
   */
  async softDelete(id: number): Promise<void> {
    try {
      await this.messageRepository.update({ id }, { is_deleted: true })
    } catch (error) {
      this.logger.error('Failed to soft delete message', error)
      this.errorLogsService.logError({
        message: 'Failed to soft delete message',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }

  /**
   * Returns all messages in a room that have no translation cache entry.
   * Used to batch-retranslate after cache is cleared.
   */
  async findUntranslatedByRoom(
    roomId: number,
  ): Promise<Array<{ id: number; content: string; detected_lang: string }>> {
    try {
      return this.messageRepository.query(
        `SELECT m.id, m.content, m.detected_lang
         FROM messages m
         LEFT JOIN translation_cache tc ON tc.message_id = m.id
         WHERE m.room_id = ? AND tc.message_id IS NULL AND m.is_deleted = 0
         ORDER BY m.id ASC`,
        [roomId],
      )
    } catch (error) {
      this.logger.error('Failed to find untranslated messages by room', error)
      this.errorLogsService.logError({
        message: 'Failed to find untranslated messages by room',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }

  async update(id: number, data: { content: string; previousContent: string }): Promise<Message> {
    const message = await this.messageRepository.findOneBy({ id })

    if (!message) {
      throw new Error('Message not found')
    }

    message.previous_content = data.previousContent
    message.content = data.content
    message.is_edited = true
    message.updated_at = new Date()

    try {
      return this.messageRepository.save(message)
    } catch (error) {
      this.logger.error('Failed to update message', error)
      this.errorLogsService.logError({
        message: 'Failed to update message',
        stackTrace: (error as Error).stack ?? null,
        path: 'messages',
      })
      throw error
    }
  }
}

export interface MessageWithTranslation {
  id: number
  room_id: number
  user_id: number
  content: string
  detected_lang: string | null
  is_edited: boolean
  previous_content: string | null
  created_at: Date
  updated_at: Date
  username: string
  avatar: string | null
  language: string
  translations: Record<string, string> | null
  reactions: Array<{ emoji: string; count: number; userIds: number[] }>
}
