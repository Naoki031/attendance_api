import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator'
import { ChatRoomVisibility } from '../entities/chat-room.entity'

export class UpdateChatRoomDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsOptional()
  @IsEnum(ChatRoomVisibility)
  visibility?: ChatRoomVisibility
}
