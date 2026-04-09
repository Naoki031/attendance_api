import { IsNotEmpty, IsNumber } from 'class-validator'

export class CreateUserGroupPermissionDto {
  @IsNotEmpty()
  @IsNumber()
  user_id: number

  @IsNotEmpty()
  @IsNumber()
  permission_group_id: number
}
