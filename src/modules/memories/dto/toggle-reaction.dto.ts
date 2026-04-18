import { IsEnum } from 'class-validator'
import { ReactionType } from '../entities/memory_reaction.entity'

export class ToggleReactionDto {
  @IsEnum(ReactionType)
  type!: ReactionType
}
