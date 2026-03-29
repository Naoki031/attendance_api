import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator'

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  slug!: string

  @IsNumber()
  @IsOptional()
  country_id?: number

  @IsNumber()
  @IsOptional()
  city_id?: number

  @IsString()
  @IsOptional()
  address?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  website?: string

  @IsString()
  @IsOptional()
  logo?: string

  @IsString()
  @IsNotEmpty()
  work_start_time!: string

  @IsString()
  @IsNotEmpty()
  work_end_time!: string

  @IsString()
  @IsOptional()
  allowed_ips?: string

  @IsString()
  @IsOptional()
  google_calendar_id?: string
}
