import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Message } from './entities/message.entity'
import { MessageReactionsService } from '@/modules/message_reactions/message-reactions.service'

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly messageReactionsService: MessageReactionsService,
  ) {}

  async create(data: {
    roomId: number
    userId: number
    content: string
    detectedLang: string
    parentId?: number | null
  }): Promise<Message> {
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
  }

  async findOne(id: number): Promise<Message | null> {
    return this.messageRepository.findOneBy({ id })
  }

  async findByRoom(
    roomId: number,
    cursor?: number,
    limit = 50,
  ): Promise<{ messages: MessageWithTranslation[]; nextCursor: number | null }> {
    const cursorValue = cursor ?? null

    const results = await this.messageRepository.query(
      `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as username, u.avatar, u.preferred_language as language, tc.translations,
              (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id) as reply_count
       FROM messages m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN translation_cache tc ON tc.message_id = m.id
       WHERE m.room_id = ?
         AND m.parent_id IS NULL
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

    // Attach grouped reactions
    const messageIds = messages.map((message: MessageWithTranslation) => message.id)
    const reactionsMap = await this.messageReactionsService.getGroupedForMessages(messageIds)

    for (const message of messages) {
      message.reactions = reactionsMap.get(message.id) ?? []
    }

    return { messages, nextCursor }
  }

  async findByThread(parentMessageId: number): Promise<MessageWithTranslation[]> {
    const results = await this.messageRepository.query(
      `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as username, u.avatar, u.preferred_language as language, tc.translations
       FROM messages m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN translation_cache tc ON tc.message_id = m.id
       WHERE m.parent_id = ?
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

    return this.messageRepository.save(message)
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
