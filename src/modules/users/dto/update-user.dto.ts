import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'

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
  @Type(() => Number)
  contract_count?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  contract_expiry_reminder_days?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  annual_leave_hours?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  remaining_leave_hours?: number | null

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.filter((id) => id != null) : value))
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
