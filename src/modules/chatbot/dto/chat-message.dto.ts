import { IsString, IsNotEmpty, IsArray, IsIn, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

export class ChatMessageItemDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  @IsNotEmpty()
  content!: string
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageItemDto)
  messages!: ChatMessageItemDto[]

  @IsOptional()
  @IsString()
  @IsIn(['professional', 'friendly', 'concise'])
  tone?: string

  @IsOptional()
  @IsString()
  @IsIn(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'])
  model?: string

  @IsOptional()
  @IsString()
  language?: string
}
