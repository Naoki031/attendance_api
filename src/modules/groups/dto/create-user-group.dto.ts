import { IsNumber, IsNotEmpty } from 'class-validator'

export class CreateUserGroupDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number
}
