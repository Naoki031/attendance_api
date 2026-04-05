import { IsArray, IsNumber, IsOptional } from 'class-validator'

export class InviteUsersDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  user_ids?: number[]

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  groupIds?: number[]
}
