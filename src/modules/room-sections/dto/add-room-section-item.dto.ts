import { IsString, IsNotEmpty, IsNumber, IsIn } from 'class-validator'

export class AddRoomSectionItemDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['meeting', 'chat_room'])
  resource_type!: 'meeting' | 'chat_room'

  @IsNumber()
  @IsNotEmpty()
  resource_id!: number
}
