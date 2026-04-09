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
  @IsIn(['professional', 'friendly', 'concise', 'rapper'])
  tone?: string

  @IsOptional()
  @IsString()
  language?: string
}
