import { IsNumber, IsNotEmpty } from 'class-validator'

export class InviteUserDto {
  @IsNumber()
  @IsNotEmpty()
  user_id!: number
}
