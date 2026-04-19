import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MessageReaction } from './entities/message-reaction.entity'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

export interface ReactionGroup {
  emoji: string
  count: number
  userIds: number[]
  userNames: string[]
}

@Injectable()
export class MessageReactionsService {
  private readonly logger = new Logger(MessageReactionsService.name)

  constructor(
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
    private readonly errorLogsService: ErrorLogsService,
  ) {}

  /**
   * Switches a reaction for a user on a message:
   * - Same emoji clicked → removes it (toggle off)
   * - Different emoji clicked → removes previous reaction and adds new one (switch)
   * - No previous reaction → adds new one
   * Returns the updated grouped reactions for the message.
   */
  async toggle(messageId: number, userId: number, emoji: string): Promise<ReactionGroup[]> {
    try {
      const existing = await this.reactionRepository.findOne({
        where: { message_id: messageId, user_id: userId },
      })

      if (existing) {
        await this.reactionRepository.delete({ id: existing.id })

        // Same emoji clicked — just remove (toggle off), don't re-add
        if (existing.emoji === emoji) {
          return this.getGroupedByMessage(messageId)
        }
      }

      await this.reactionRepository.save({ message_id: messageId, user_id: userId, emoji })

      return this.getGroupedByMessage(messageId)
    } catch (error) {
      this.logger.error('Failed to toggle reaction', error)
      this.errorLogsService.logError({
        message: 'Failed to toggle reaction',
        stackTrace: (error as Error).stack ?? null,
        path: 'message_reactions',
      })
      throw error
    }
  }

  /**
   * Returns all reactions for a message grouped by emoji.
   */
  async getGroupedByMessage(messageId: number): Promise<ReactionGroup[]> {
    try {
      const reactions = await this.reactionRepository.find({
        where: { message_id: messageId },
        relations: ['user'],
      })

      const grouped = new Map<string, { userIds: number[]; userNames: string[] }>()

      for (const reaction of reactions) {
        const existing = grouped.get(reaction.emoji) ?? { userIds: [], userNames: [] }
        existing.userIds.push(reaction.user_id)
        existing.userNames.push(reaction.user?.full_name ?? `User ${reaction.user_id}`)
        grouped.set(reaction.emoji, existing)
      }

      return Array.from(grouped.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.userIds.length,
        userIds: data.userIds,
        userNames: data.userNames,
      }))
    } catch (error) {
      this.logger.error('Failed to get grouped reactions by message', error)
      this.errorLogsService.logError({
        message: 'Failed to get grouped reactions by message',
        stackTrace: (error as Error).stack ?? null,
        path: 'message_reactions',
      })
      return []
    }
  }

  /**
   * Returns grouped reactions for multiple messages at once.
   * Used when loading a room's messages to avoid N+1 queries.
   */
  async getGroupedForMessages(messageIds: number[]): Promise<Map<number, ReactionGroup[]>> {
    if (messageIds.length === 0) return new Map()

    try {
      const reactions = await this.reactionRepository
        .createQueryBuilder('reaction')
        .leftJoinAndSelect('reaction.user', 'user')
        .where('reaction.message_id IN (:...messageIds)', { messageIds })
        .getMany()

      const byMessage = new Map<number, Map<string, { userIds: number[]; userNames: string[] }>>()

      for (const reaction of reactions) {
        if (!byMessage.has(reaction.message_id)) {
          byMessage.set(reaction.message_id, new Map())
        }

        const emojiMap = byMessage.get(reaction.message_id)!
        const data = emojiMap.get(reaction.emoji) ?? { userIds: [], userNames: [] }
        data.userIds.push(reaction.user_id)
        data.userNames.push(reaction.user?.full_name ?? `User ${reaction.user_id}`)
        emojiMap.set(reaction.emoji, data)
      }

      const result = new Map<number, ReactionGroup[]>()

      for (const [messageId, emojiMap] of byMessage.entries()) {
        result.set(
          messageId,
          Array.from(emojiMap.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.userIds.length,
            userIds: data.userIds,
            userNames: data.userNames,
          })),
        )
      }

      return result
    } catch (error) {
      this.logger.error('Failed to get grouped reactions for messages', error)
      this.errorLogsService.logError({
        message: 'Failed to get grouped reactions for messages',
        stackTrace: (error as Error).stack ?? null,
        path: 'message_reactions',
      })
      return new Map()
    }
  }
}
