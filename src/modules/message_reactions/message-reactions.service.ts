import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MessageReaction } from './entities/message-reaction.entity'

export interface ReactionGroup {
  emoji: string
  count: number
  userIds: number[]
}

@Injectable()
export class MessageReactionsService {
  constructor(
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
  ) {}

  /**
   * Switches a reaction for a user on a message:
   * - Same emoji clicked → removes it (toggle off)
   * - Different emoji clicked → removes previous reaction and adds new one (switch)
   * - No previous reaction → adds new one
   * Returns the updated grouped reactions for the message.
   */
  async toggle(messageId: number, userId: number, emoji: string): Promise<ReactionGroup[]> {
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
  }

  /**
   * Returns all reactions for a message grouped by emoji.
   */
  async getGroupedByMessage(messageId: number): Promise<ReactionGroup[]> {
    const reactions = await this.reactionRepository.find({
      where: { message_id: messageId },
    })

    const grouped = new Map<string, number[]>()

    for (const reaction of reactions) {
      const existing = grouped.get(reaction.emoji) ?? []
      existing.push(reaction.user_id)
      grouped.set(reaction.emoji, existing)
    }

    return Array.from(grouped.entries()).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }))
  }

  /**
   * Returns grouped reactions for multiple messages at once.
   * Used when loading a room's messages to avoid N+1 queries.
   */
  async getGroupedForMessages(messageIds: number[]): Promise<Map<number, ReactionGroup[]>> {
    if (messageIds.length === 0) return new Map()

    const reactions = await this.reactionRepository
      .createQueryBuilder('reaction')
      .where('reaction.message_id IN (:...messageIds)', { messageIds })
      .getMany()

    const byMessage = new Map<number, Map<string, number[]>>()

    for (const reaction of reactions) {
      if (!byMessage.has(reaction.message_id)) {
        byMessage.set(reaction.message_id, new Map())
      }

      const emojiMap = byMessage.get(reaction.message_id)!
      const userIds = emojiMap.get(reaction.emoji) ?? []
      userIds.push(reaction.user_id)
      emojiMap.set(reaction.emoji, userIds)
    }

    const result = new Map<number, ReactionGroup[]>()

    for (const [messageId, emojiMap] of byMessage.entries()) {
      result.set(
        messageId,
        Array.from(emojiMap.entries()).map(([emoji, userIds]) => ({
          emoji,
          count: userIds.length,
          userIds,
        })),
      )
    }

    return result
  }
}
