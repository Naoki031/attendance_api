import { IsString, IsNotEmpty, IsNumber, IsIn } from 'class-validator'
import { Type } from 'class-transformer'

export class RemoveRoomSectionItemDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['meeting', 'chat_room'])
  resource_type!: 'meeting' | 'chat_room'

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  resource_id!: number
}
