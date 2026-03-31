import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateIf,
} from 'class-validator'
import { ChatRoomType, ChatRoomVisibility } from '../entities/chat-room.entity'

export class CreateChatRoomDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsOptional()
  @IsEnum(ChatRoomType)
  type?: ChatRoomType

  @IsOptional()
  @IsEnum(ChatRoomVisibility)
  visibility?: ChatRoomVisibility

  @ValidateIf((dto: CreateChatRoomDto) => dto.type === ChatRoomType.DIRECT)
  @IsNumber()
  targetUserId!: number

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  memberUserIds?: number[]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  groupIds?: number[]
}
