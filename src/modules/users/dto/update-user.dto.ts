import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  first_name?: string

  @IsOptional()
  @IsString()
  last_name?: string

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string

  @IsOptional()
  @IsBoolean()
  is_active?: boolean

  @IsOptional()
  @IsString()
  position?: string

  @IsOptional()
  @IsString()
  phone_number?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  date_of_birth?: string

  @IsOptional()
  @IsString()
  join_date?: string

  @IsOptional()
  @IsString()
  contract_signed_date?: string

  @IsOptional()
  @IsString()
  contract_expired_date?: string

  @IsOptional()
  @IsString()
  contract_type?: string

  @IsOptional()
  @IsNumber()
  contract_count?: number

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  permission_group_ids?: number[]

  @IsOptional()
  @IsString()
  slack_id?: string | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  device_user_id?: number | null

  @IsOptional()
  @IsBoolean()
  skip_attendance?: boolean

  @IsOptional()
  @IsBoolean()
  permanent_remote?: boolean

  @IsOptional()
  @IsString()
  permanent_remote_reason?: string | null

  @IsOptional()
  @IsString()
  avatar?: string
}
