import { IsString, IsNotEmpty, IsNumber } from 'class-validator'

export class ToggleReactionDto {
  @IsNumber()
  @IsNotEmpty()
  message_id: number

  @IsNumber()
  @IsNotEmpty()
  user_id: number

  @IsString()
  @IsNotEmpty()
  emoji: string
}
