import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator'

export class CreateUserDto {
  @IsString()
  first_name: string

  @IsString()
  last_name: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  password: string

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
  contract_count?: number

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  permission_group_ids?: number[]
}
