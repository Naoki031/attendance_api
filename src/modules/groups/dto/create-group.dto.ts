import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator'

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  slug: string

  @IsOptional()
  @IsString()
  descriptions?: string

  @IsOptional()
  @IsString()
  slack_channel_id?: string

  @IsOptional()
  @IsString()
  slack_user_group_id?: string

  @IsOptional()
  @IsInt()
  company_id?: number
}
