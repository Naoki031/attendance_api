import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  first_name: string

  @IsNotEmpty()
  @IsString()
  last_name: string

  @IsNotEmpty()
  @IsEmail()
  email: string

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string

  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean

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
  annual_leave_hours?: number | null

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  remaining_leave_hours?: number | null

  @IsOptional()
  @IsString()
  slack_id?: string

  @IsOptional()
  @IsBoolean()
  skip_attendance?: boolean

  @IsOptional()
  @IsBoolean()
  permanent_remote?: boolean

  @IsOptional()
  @IsString()
  permanent_remote_reason?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  device_user_id?: number

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.filter((id) => id != null) : value))
  permission_group_ids?: number[]
}
